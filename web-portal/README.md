# AetherGuard AI - Web Portal

Modern web-based control portal for AetherGuard AI firewall management.

## Features

- **Dashboard**: Real-time metrics and monitoring
- **Budget Management**: Token budget tracking and visualization
- **Analytics**: Advanced analytics and reporting
- **Audit Logs**: Immutable audit log viewer
- **Policy Management**: Firewall policy configuration

## Tech Stack

- React 18 with TypeScript
- Vite for fast development
- React Router for navigation
- TanStack Query for data fetching
- Recharts for data visualization
- Lucide React for icons

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- AetherGuard proxy engine running on `localhost:8080`

### Installation

```bash
cd web-portal
npm install
```

### Development

```bash
npm run dev
```

Open http://localhost:3000 in your browser.

### Build for Production

```bash
npm run build
```

The built files will be in the `dist/` directory.

## API Integration

The portal connects to the AetherGuard proxy engine API:

- **Base URL**: `http://localhost:8080/api`
- **Endpoints**:
  - `GET /metrics` - Real-time metrics
  - `GET /budgets` - User budget information
  - `GET /audit` - Audit logs
  - `GET /policies` - Policy configurations

## Features Implemented

### Budget Dashboard ✅

- Real-time budget tracking
- Per-user budget visualization
- Daily and monthly views
- Usage percentage indicators
- Top consumers pie chart
- Budget alerts (>90% usage highlighted)

### Dashboard ✅

- Total requests counter
- Blocked requests counter
- Average latency display
- Active users count
- 24-hour latency trend chart
- Security detection summary

## Deployment

### Docker

```bash
docker build -t aetherguard-portal .
docker run -p 3000:3000 aetherguard-portal
```

### AWS S3 + CloudFront

```bash
npm run build
aws s3 sync dist/ s3://your-bucket-name/
aws cloudfront create-invalidation --distribution-id YOUR_DIST_ID --paths "/*"
```

## Configuration

Environment variables (create `.env` file):

```env
VITE_API_URL=http://localhost:8080/api
VITE_WS_URL=ws://localhost:8080/ws
```

## Security

- All API calls require authentication
- CORS configured for production domains
- CSP headers enforced
- XSS protection enabled

## Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+

## License

Proprietary - AetherGuard AI
