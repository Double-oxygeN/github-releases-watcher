import fs from 'node:fs/promises';
import path from 'node:path';
import yaml from 'yaml';
import axios from 'axios';
import nodemailer from 'nodemailer';
import Parser from 'rss-parser';

const CONFIG_PATH = process.env.CONFIG_PATH ?? 'config.yaml';

interface Config {
  repos: string[];
  mail: {
    host: string;
    port: number;
    secure: boolean;
    auth: {
      user: string;
      pass: string;
    };
    from: string;
    to: string;
  };
  jsonFilePath: string;
}

interface Release {
  id: string;
  title: string;
  link: string;
  published: string;
}

interface ReleasesData {
  [repo: string]: Release;
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return typeof error === 'object' && error !== null && 'code' in error;
}

async function readReleasesData(filePath: string): Promise<ReleasesData> {
  try {
    const data = await fs.readFile(filePath, 'utf8');
    return JSON.parse(data);
  } catch (error: unknown) {
    if (isNodeError(error) && error.code === 'ENOENT') {
      return {}; // File not found, return empty object
    }
    throw error;
  }
}

async function writeReleasesData(filePath: string, data: ReleasesData): Promise<void> {
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
}

async function main() {
  const config = yaml.parse(await fs.readFile(CONFIG_PATH, 'utf8')) as Config;

  // Ensure the directory for the JSON file exists
  const jsonDir = path.dirname(config.jsonFilePath);
  await fs.mkdir(jsonDir, { recursive: true });

  const releasesData = await readReleasesData(config.jsonFilePath);

  for (const repo of config.repos) {
    try {
      const url = `https://github.com/${repo}/releases.atom`;
      const response = await axios.get(url);
      const releases = await parseRss(response.data);

      // Sort releases by published date in descending order (newest first)
      releases.sort((a, b) => new Date(b.published).getTime() - new Date(a.published).getTime());

      // Process only the latest release
      if (releases.length > 0) {
        const latestRelease = releases[0];
        // Only update if the latest release is different from the one already stored
        if (!releasesData[repo] || releasesData[repo].id !== latestRelease.id) {
          releasesData[repo] = latestRelease;
          await sendNotification(config, repo, latestRelease);
        }
      }
    } catch (error) {
      console.error(`Error processing repo ${repo}:`, error);
    }
  }

  await writeReleasesData(config.jsonFilePath, releasesData);
  console.log("Releases data saved.");
}

async function parseRss(rss: string): Promise<Release[]> {
  const parser = new Parser();
  const feed = await parser.parseString(rss);

  return feed.items.map(item => ({
    id: item.id || item.guid || item.link || '',
    title: item.title || '',
    link: item.link || '',
    published: item.pubDate || '',
  }));
}

async function sendNotification(config: Config, repo: string, release: Release) {
  const transporter = nodemailer.createTransport({
    host: config.mail.host,
    port: config.mail.port,
    secure: config.mail.secure,
    auth: config.mail.auth,
  });

  const mailOptions = {
    from: config.mail.from,
    to: config.mail.to,
    subject: `New release from ${repo}: ${release.title}`,
    text: `A new release has been published for ${repo}.\n\nTitle: ${release.title}\nLink: ${release.link}\nPublished: ${release.published}`,
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`Notification sent for ${repo} - ${release.title}`);
  } catch (error) {
    console.error(`Error sending notification for ${repo}:`, error);
  }
}

main().catch(console.error);
