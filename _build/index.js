const path = require('path')
const fs = require('fs')

// Sync the versions across all packages from the root package.json
function syncVersions() {
  // Packages to update
  const packages = ['core', 'components', 'reactive', 'router', 'reactive-dom']

  // Get the root package
  const root = require(path.join(__dirname, '..', 'package.json'))
  const version = root.version.split('.')
  const increment =  process.argv[3] || 'no'

  switch (increment) {
    case 'major':
      packages.push('.')
      version[0]++
      version[1] = 0
      version[2] = 0
      break
    case 'minor':
      packages.push('.')
      version[1]++
      version[2] = 0
      break
    case 'patch':
      packages.push('.')
      version[2]++
      break
    default:
      break
  }

  // Update the versions
  packages.forEach(pkg => {
    const packageJson = require(path.join(__dirname, '..', pkg, 'package.json'))
    packageJson.version = version.join('.')
    fs.writeFileSync(path.join(__dirname, '..', pkg, 'package.json'), JSON.stringify(packageJson, null, 2))
  })
}

// Expose commands
switch (process.argv[2]) {
  case 'sync-versions':
    syncVersions()
    break
  default:
    break
}