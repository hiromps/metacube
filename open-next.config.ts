import type { OpenNextConfig } from 'open-next/types'

const config: OpenNextConfig = {
  default: {
    runtime: 'node',
    placement: 'regional',
    override: {
      wrapper: 'cloudflare',
      converter: 'edge',
      generateDockerfile: false,
    },
  },
  functions: {
    api: {
      runtime: 'edge',
      placement: 'global',
      patterns: ['api/**'],
    },
  },
  middleware: {
    runtime: 'edge',
    placement: 'global',
  },
}

export default config