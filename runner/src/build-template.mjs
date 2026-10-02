import 'dotenv/config';
import { Template } from 'e2b';

const apiKey = process.env.E2B_API_KEY;
if (!apiKey) {
  throw new Error('Set E2B_API_KEY in runner/.env before building the hosted language template.');
}

const templateName = process.env.E2B_TEMPLATE || 'codementor-interactive';
const template = Template()
  .fromUbuntuImage('24.04')
  .aptInstall([
    'ca-certificates',
    'default-jdk-headless',
    'g++',
    'gcc',
    'golang-go',
    'kotlin',
    'mono-devel',
    'nodejs',
    'php-cli',
    'python3',
    'ruby',
    'rustc',
  ]);

console.log(`Building E2B template "${templateName}" with the supported console runtimes.`);
const result = await Template.build(template, templateName, {
  apiKey,
  cpuCount: 2,
  memoryMB: 4096,
  onBuildLogs: (entry) => {
    if (entry.message) console.log(entry.message);
  },
});
console.log(`E2B template is ready: ${result.templateId}`);
