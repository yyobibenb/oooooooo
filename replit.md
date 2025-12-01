# Crypto Arbitrage Monitoring System

## Overview

A real-time cryptocurrency arbitrage monitoring dashboard that tracks price differences across 8 major exchanges (Bybit, OKX, MEXC, Bitget, Gate.io, KuCoin, CoinEx, BingX) for 20+ trading pairs. The system identifies profitable arbitrage opportunities by comparing live prices via WebSocket connections and sends alerts through Telegram when configurable profit thresholds are met.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

**Framework**: React with TypeScript using Vite as the build tool and development server.

**UI Component System**: shadcn/ui components built on Radix UI primitives with Tailwind CSS for styling. The design follows a modern fintech dashboard aesthetic inspired by TradingView and Binance, prioritizing data density and scannable information hierarchy.

**State Management**: TanStack Query (React Query) for server state management. Real-time updates are handled through WebSocket connections with local state for UI interactions.

**Routing**: Wouter for lightweight client-side routing (though currently only a single dashboard route exists).

**Design Tokens**: Custom Tailwind configuration with HSL-based color system supporting light/dark modes, monospace fonts (JetBrains Mono) for numerical data, and consistent spacing scale.

### Backend Architecture

**Server Framework**: Express.js with TypeScript running on Node.js. The server uses ESM module syntax and is bundled with esbuild for production deployment.

**Real-time Communication**: WebSocket server (ws library) mounted at `/ws` path for bidirectional communication. The server broadcasts ticker updates, arbitrage opportunities, connection statuses, and signals to all connected clients.

**Exchange Integration Layer**: Object-oriented architecture with a base `BaseExchange` class that implements common WebSocket connection logic, reconnection handling, ping/pong mechanisms, and event emission. Each exchange (8 total) extends this base class with exchange-specific protocol implementations for ticker and order book subscriptions.

**Arbitrage Engine**: Event-driven service that continuously analyzes ticker data from all exchanges to identify price spreads. Runs analysis every second across all enabled trading pairs, calculating potential profit after accounting for exchange-specific maker/taker fees. Implements cooldown logic to prevent duplicate alerts.

**Telegram Integration**: Optional notification service that sends formatted messages about arbitrage opportunities to configured Telegram bot/chat when enabled.

**Data Storage**: In-memory storage implementation (`MemStorage`) for settings, opportunities, signals, tickers, and connection statuses. The system is designed with a storage interface (`IStorage`) allowing future database implementations.

### External Dependencies

**Cryptocurrency Exchanges**:
- 8 exchange WebSocket APIs: Bybit, OKX, MEXC, Bitget, Gate.io, KuCoin, CoinEx, BingX
- Each has unique WebSocket protocol, message formats, and symbol conventions
- Connection status monitoring with automatic reconnection

**Telegram Bot API**: 
- Used for sending arbitrage opportunity alerts
- Requires `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` environment variables
- Optional feature that can be disabled

**Database** (Configured but not actively used):
- Drizzle ORM configured for PostgreSQL via `@neondatabase/serverless`
- Schema definitions exist in `shared/schema.ts`
- Database URL expected in `DATABASE_URL` environment variable
- Currently not integrated into the application logic

**Build and Development Tools**:
- Vite for frontend bundling and HMR
- esbuild for server-side bundling in production
- TypeScript compiler for type checking
- Tailwind CSS with PostCSS for styling
- Replit-specific plugins for development environment integration

**UI Component Libraries**:
- Radix UI primitives for accessible component foundations
- shadcn/ui component patterns
- Embla Carousel for carousel functionality
- cmdk for command palette patterns
- class-variance-authority for component variant management