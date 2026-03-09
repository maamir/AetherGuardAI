# AetherGuard AI - Web Portal

Modern, full-featured web-based control portal for AetherGuard AI firewall management with complete tenant onboarding and multi-tenant support.

## Features

### Authentication & Onboarding
- **Login/Signup**: Complete authentication flow with SSO support (SAML, OAuth, Active Directory)
- **Client Onboarding**: 3-step guided onboarding process
  - API key generation
  - Security settings configuration
  - Integration guide with code examples
- **Multi-Factor Authentication**: MFA support for enhanced security

### Dashboards
- **Dashboard**: Real-time metrics and monitoring overview
- **Real-Time Dashboard**: Live detection feed with WebSocket updates
- **Advanced Analytics**: Time-series analysis, heatmaps, and cost projections

### Management
- **Tenant Management**: Complete multi-tenant administration
  - Tenant creation and configuration
  - Tier management (Free, Starter, Professional, Enterprise)
  - Usage tracking and quota management
  - Per-tenant security settings
- **User Management**: User account and permission control
  - Role-based access control (Admin, Operator, Analyst, Viewer, Developer)
  - MFA configuration
  - Session management
  - User activity tracking
- **API Keys**: API key lifecycle management
  - Create and revoke API keys
  - Usage tracking per key
  - Key visibility controls
  - Copy to clipboard functionality

### Security & Compliance
- **Policy Management**: Firewall policy configuration and editing
- **Audit Logs**: Immutable audit log viewer with chain of custody
- **Model Management**: ML model registry and versioning

### Analytics & Reporting
- **Budget Management**: Token budget tracking and visualization
- **Analytics**: Advanced analytics and reporting
- **Cost Tracking**: Real-time cost monitoring and projections

## Tech Stack

- React 18 with TypeScript
- Vite for fast development
- React Router for navigation
- TanStack Query for data fetching
- Recharts for data visualization
- Lucide React for icons
- Tailwind CSS for styling

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

## Pages & Routes

### Public Routes
- `/login` - User login with SSO options
- `/signup` - New tenant registration with tier selection
- `/onboarding` - Guided onboarding flow

### Protected Routes
- `/` - Main dashboard
- `/realtime` - Real-time detection dashboard
- `/advanced-analytics` - Advanced analytics and insights
- `/budgets` - Budget management
- `/analytics` - Analytics overview
- `/audit` - Audit logs viewer
- `/policies` - Policy management
- `/policies/edit/:id` - Policy editor
- `/models` - Model management
- `/tenants` - Tenant administration (Admin only)
- `/users` - User management (Admin/Operator)
- `/api-keys` - API key management

## User Roles & Permissions

### Admin
- Full system access
- User and tenant management
- Policy configuration
- Billing and subscription management

### Operator
- View metrics and analytics
- Manage policies
- View audit logs
- Configure detectors

### Analyst
- View metrics and analytics
- View audit logs
- Generate reports
- Export data

### Viewer
- View metrics
- View audit logs
- Read-only access

### Developer
- API access
- View metrics
- Test detectors
- Access documentation

## API Integration

The portal connects to the AetherGuard proxy engine API:

- **Base URL**: `http://localhost:8080/api`
- **Authentication**: Bearer token (JWT)
- **Endpoints**:
  - `POST /auth/login` - User authentication
  - `POST /auth/signup` - New tenant registration
  - `POST /auth/sso/{provider}` - SSO authentication
  - `GET /metrics` - Real-time metrics
  - `GET /budgets` - User budget information
  - `GET /audit` - Audit logs
  - `GET /policies` - Policy configurations
  - `GET /tenants` - Tenant list (Admin only)
  - `GET /users` - User list
  - `GET /api-keys` - API keys
  - `POST /api-keys` - Create API key
  - `DELETE /api-keys/:id` - Revoke API key

## Features Implemented

### Authentication ✅
- Login with email/password
- SSO integration (SAML, OAuth, Active Directory)
- JWT token management
- Protected routes
- Logout functionality

### Onboarding ✅
- 3-step guided process
- API key generation
- Security configuration
- Integration code examples
- Quick tips and documentation links

### Tenant Management ✅
- Tenant creation and editing
- Tier assignment (Free, Starter, Professional, Enterprise)
- Usage tracking and quotas
- Status management (Active, Trial, Suspended)
- Per-tenant security settings
- Billing email configuration

### User Management ✅
- User creation and editing
- Role assignment with RBAC
- MFA configuration
- Status management
- Session management
- Password reset
- Activity tracking

### API Keys ✅
- Create new API keys
- View and manage existing keys
- Revoke keys
- Usage tracking per key
- Show/hide key values
- Copy to clipboard

### Dashboards ✅
- Real-time metrics display
- Live detection feed
- Usage charts and graphs
- Cost projections
- Security alerts

### Budget Management ✅
- Real-time budget tracking
- Per-user budget visualization
- Daily and monthly views
- Usage percentage indicators
- Top consumers analysis
- Budget alerts

### Policy Management ✅
- Policy creation and editing
- JSON policy editor
- Policy validation
- Version control

### Audit Logs ✅
- Immutable log viewer
- Chain of custody visualization
- Tamper detection
- Event filtering
- Export functionality

### Model Management ✅
- Model registry
- Version tracking
- Performance metrics
- Deployment status

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

- JWT-based authentication
- Protected routes with token validation
- CORS configured for production domains
- CSP headers enforced
- XSS protection enabled
- Secure API key storage
- MFA support

## Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+

## Development

### Project Structure

```
web-portal/
├── src/
│   ├── components/
│   │   └── Layout.tsx          # Main layout with navigation
│   ├── hooks/
│   │   └── useWebSocket.ts     # WebSocket hook
│   ├── pages/
│   │   ├── Login.tsx           # Login page
│   │   ├── Signup.tsx          # Signup with tier selection
│   │   ├── Onboarding.tsx      # Guided onboarding
│   │   ├── Dashboard.tsx       # Main dashboard
│   │   ├── RealTimeDashboard.tsx
│   │   ├── AdvancedAnalytics.tsx
│   │   ├── BudgetManagement.tsx
│   │   ├── Analytics.tsx
│   │   ├── AuditLogs.tsx
│   │   ├── Policies.tsx
│   │   ├── PolicyEditor.tsx
│   │   ├── ModelManagement.tsx
│   │   ├── TenantManagement.tsx
│   │   ├── UserManagement.tsx
│   │   └── ApiKeys.tsx
│   ├── App.tsx                 # Main app with routing
│   ├── main.tsx                # Entry point
│   └── index.css               # Global styles
├── package.json
└── vite.config.ts
```

## License

Proprietary - AetherGuard AI
