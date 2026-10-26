import { access } from 'node:fs/promises'

const requiredFiles = [
  'dist/index.html',
  'dist/admin.html',
  'functions/api.mjs'
]

const missingFiles = []
for (const file of requiredFiles) {
  try {
    await access(new URL(`../${file}`, import.meta.url))
  } catch {
    missingFiles.push(file)
  }
}

if (missingFiles.length) {
  console.error(`Required Netlify files are missing: ${missingFiles.join(', ')}`)
  process.exit(1)
}

console.log('Static website files and Netlify Function source are ready to deploy.')
