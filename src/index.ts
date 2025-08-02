// Copyright 2025 Yuya Shiratori
// 
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
// 
//     http://www.apache.org/licenses/LICENSE-2.0
// 
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import fs from 'node:fs/promises';
import path from 'node:path';
import yaml from 'yaml';
import axios from 'axios';
import nodemailer from 'nodemailer';
import Parser from 'rss-parser';

const CONFIG_PATH = process.env.CONFIG_PATH ?? 'config.yaml';

interface MailOptions {
  host: string;
  port: number;
  secure: boolean;
  auth: {
    user: string;
    pass: string;
  };
  from: string;
  to: string;
}

interface RepoConfig {
  pattern?: string;
}

interface Config {
  repos: Record<string, RepoConfig>;
  mail: MailOptions;
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

const regexCache: Record<string, RegExp> = {};

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return typeof error === 'object' && error !== null && 'code' in error;
}

function isMailOptions(obj: unknown): obj is MailOptions {
  if (typeof obj !== 'object' || obj === null) return false;
  const mailOpts = obj as Partial<MailOptions>;
  return (
    typeof mailOpts.host === 'string' &&
    typeof mailOpts.port === 'number' &&
    typeof mailOpts.secure === 'boolean' &&
    typeof mailOpts.auth === 'object' &&
    mailOpts.auth !== null &&
    typeof mailOpts.auth.user === 'string' &&
    typeof mailOpts.auth.pass === 'string' &&
    typeof mailOpts.from === 'string' &&
    typeof mailOpts.to === 'string'
  );
}

function isValidPattern(pattern: string): boolean {
  if (pattern in regexCache) {
    return true; // Already validated and cached
  }

  try {
    const regex = new RegExp(pattern);
    regexCache[pattern] = regex;
    return true;
  } catch {
    return false;
  }
}

function isRepoConfig(obj: unknown): obj is RepoConfig {
  if (typeof obj !== 'object' || obj === null) return false;
  const repoConfig = obj as Partial<RepoConfig>;
  return repoConfig.pattern === undefined || (typeof repoConfig.pattern === 'string' && isValidPattern(repoConfig.pattern));
}

function isConfig(obj: unknown): obj is Config {
  if (typeof obj !== 'object' || obj === null) return false;
  const config = obj as Partial<Config>;
  return (
    typeof config.repos === 'object' &&
    config.repos !== null &&
    !Array.isArray(config.repos) &&
    Object.values(config.repos).every(isRepoConfig) &&
    isMailOptions(config.mail) &&
    typeof config.jsonFilePath === 'string'
  );
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
  try {
    const configContent = await fs.readFile(CONFIG_PATH, 'utf8');
    const parsedConfig = yaml.parse(configContent);
    if (!isConfig(parsedConfig)) {
      throw new Error('Invalid YAML format. Please ensure all required fields are present and correctly typed.');
    }
    const config: Config = parsedConfig;

    // Ensure the directory for the JSON file exists
    const jsonDir = path.dirname(config.jsonFilePath);
    await fs.mkdir(jsonDir, { recursive: true });

    const releasesData = await readReleasesData(config.jsonFilePath);

    for (const [repo, repoConfig] of Object.entries(config.repos)) {
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

            const shouldSendNotification = shouldNotifyRelease(repoConfig, latestRelease);

            if (shouldSendNotification) {
              await sendNotification(config, repo, latestRelease);
            } else {
              console.log(`Release "${latestRelease.title}" for ${repo} does not match the repo's notification criteria, notification skipped.`);
            }
          }
        }
      } catch (error) {
        console.error(`Error processing repo ${repo}:`, error);
      }
    }

    await writeReleasesData(config.jsonFilePath, releasesData);
    console.log("Releases data saved.");
  } catch (error: unknown) {
    if (isNodeError(error) && error.code === 'ENOENT') {
      console.error(`Error: Config file not found at ${CONFIG_PATH}. Please create one based on config.example.yaml.`);
    } else if (error instanceof Error) {
      console.error(`An unexpected error occurred: ${error.message}`);
    } else {
      console.error(`An unknown error occurred: ${error}`);
    }
    process.exit(1); // Exit with an error code
  }
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

function shouldNotifyRelease(repoConfig: RepoConfig, release: Release): boolean {
  if (!repoConfig.pattern) {
    return true; // No pattern means all releases should trigger notifications
  }

  if (repoConfig.pattern in regexCache) {
    return regexCache[repoConfig.pattern].test(release.title);
  }

  // Fallback: should not happen if config validation is correct
  const regex = new RegExp(repoConfig.pattern);
  regexCache[repoConfig.pattern] = regex;
  return regex.test(release.title);
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
