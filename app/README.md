# LivingShield application

React/TypeScript township flood-resilience workspace with a Node.js data API.

See the [project README](../README.md) for the live demo, features, model boundaries and credits.

## Development

Requires Node.js 24 and npm. From this directory:

```sh
npm ci
npm run dev
```

Open http://127.0.0.1:5180. The API runs on port 3102.

## Production and verification

```sh
npm run lint
npm test
npm run build
npm start
```

The production server serves the built interface and API at http://127.0.0.1:3102 by default. Keep the server modules, production dependencies and runtime source files packaged as shown in the root Dockerfile.

See [source notices](../docs/SOURCE-NOTICES.md) for imported rendering credits and permissions, and the root documentation for data provenance.
