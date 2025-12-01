# Design Guidelines: Crypto Arbitrage Monitoring System

## Design Approach
**Design System**: Modern Fintech Dashboard (inspired by TradingView, Binance, and Linear)
**Rationale**: Professional trading tool requiring data clarity, real-time updates, and efficient information hierarchy. Users need to quickly identify arbitrage opportunities across 8 exchanges simultaneously.

## Core Design Principles
1. **Data First**: Prioritize information density without clutter
2. **Scannable Hierarchy**: Users should instantly identify profitable opportunities
3. **Status Clarity**: Real-time connection states and signal status must be obvious
4. **Professional Aesthetic**: Clean, technical, trustworthy appearance

## Typography System
- **Primary Font**: Inter or IBM Plex Sans (via Google Fonts CDN)
- **Monospace Font**: JetBrains Mono (for prices, percentages, crypto addresses)
- **Hierarchy**:
  - Page titles: text-2xl font-semibold
  - Section headers: text-lg font-medium
  - Data labels: text-sm font-medium uppercase tracking-wide
  - Primary data (prices): text-xl font-mono font-semibold
  - Secondary data: text-base font-mono
  - Table content: text-sm
  - Micro data (timestamps, status): text-xs

## Layout System
**Spacing Scale**: Use Tailwind units 2, 3, 4, 6, 8, 12, 16 for consistency
- Component padding: p-4 to p-6
- Section spacing: space-y-6 or space-y-8
- Card spacing: p-4 for compact cards, p-6 for main content
- Grid gaps: gap-4 for tight grids, gap-6 for breathing room

**Container Structure**:
- Max width: max-w-7xl mx-auto
- Dashboard grid: grid-cols-1 lg:grid-cols-12 gap-6
- Sidebar (if used): 3 columns, Main content: 9 columns

## Component Library

### Navigation
- **Top Navigation Bar**: Fixed header with logo, exchange status indicators (8 badges showing connection state), settings icon
- **Status Badges**: Small rounded pills with dot indicators for each exchange (green=connected, yellow=connecting, red=disconnected)

### Dashboard Layout
**3-Panel Structure**:
1. **Exchange Overview Panel** (top): Horizontal scrollable cards showing current prices for BTC/USDT, ETH/USDT across all 8 exchanges
2. **Arbitrage Opportunities Panel** (main, center-left): Data table with sortable columns: Pair, Buy Exchange, Sell Exchange, Spread %, Profit (USDT), Timestamp
3. **Order Book Viewer** (right sidebar): Live order book for selected exchange/pair with bid/ask depth

### Cards & Containers
- **Exchange Price Cards**: Compact cards (min-w-48) with exchange logo, pair name, current price (large mono font), 24h change indicator
- **Opportunity Cards**: Table rows that expand to show detailed calculation breakdown (fees, slippage, network costs)
- **Alert Card**: Prominent card for active signals with call-to-action to view in Telegram

### Data Tables
- **Striped rows** for readability
- **Sortable headers** with arrow indicators
- **Sticky header** for long scrolling tables
- **Compact spacing**: py-2 px-3 for cells
- **Mono font** for all numeric data
- **Status indicators**: Colored dots or badges in status columns

### Real-time Data Display
- **Live Price Ticker**: Auto-updating prices with subtle flash animation on change (brief highlight, then fade)
- **WebSocket Status**: Connection quality indicator (dots or signal bars)
- **Last Update Timestamp**: Displayed in text-xs with relative time ("2s ago")

### Telegram Integration UI
- **Signal History Panel**: List of sent signals with timestamp, exchange pair, profit estimate, and Telegram delivery status
- **Bot Configuration**: Input fields for bot token, chat ID with test connection button
- **Send Test Signal**: Button to verify Telegram integration

### Forms & Inputs
- **Configuration Inputs**: Label-input pairs with helper text
- API Key fields: Password-style inputs with show/hide toggle
- **Number Inputs**: For minimum profit threshold, update intervals
- **Dropdowns**: Multi-select for exchanges to monitor, trading pairs

### Status & Indicators
- **Connection Status Dots**: 8px rounded circles with pulse animation when active
- **Profit Indicators**: Green text/background for positive, red for negative, with percentage in parentheses
- **Progress Bars**: Thin bars (h-1) for showing order book depth/volume
- **Loading States**: Skeleton loaders for data tables, shimmer effect

### Interactive Elements
- **Buttons**: 
  - Primary actions: px-4 py-2 rounded-lg font-medium
  - Secondary: outlined variant
  - Icon buttons: square p-2 for controls
- **Tabs**: Underline style for switching between BTC/USDT, ETH/USDT, BTC/ETH pairs
- **Tooltips**: On hover for exchange names, showing full details (fees, withdrawal limits)

### Icons
**Library**: Heroicons (via CDN)
- Navigation: ChartBarIcon, BellIcon, CogIcon
- Status: CheckCircleIcon, ExclamationCircleIcon, XCircleIcon
- Actions: ArrowPathIcon (refresh), PaperAirplaneIcon (send signal)
- Data: TrendingUpIcon, TrendingDownIcon for price movements

## Dashboard Sections

1. **Header Section** (h-16): Logo left, exchange status badges center, notifications + settings right
2. **Main Dashboard Grid**: 
   - Top row: 8 exchange cards (horizontal scroll on mobile)
   - Middle row (70% height): Arbitrage opportunities table
   - Right sidebar (30% width): Order book + recent signals
3. **Footer**: Last sync time, system status, Telegram connection status

## Responsive Behavior
- **Desktop (lg+)**: Full 3-panel layout
- **Tablet (md)**: Stack panels vertically, full-width tables
- **Mobile**: Single column, collapsible sections, horizontal scroll for exchange cards

## Accessibility
- All status indicators include text labels
- Color is never the only indicator (use icons + text)
- Keyboard navigation for all interactive elements
- ARIA labels for live-updating price regions

## Animations
**Minimal and Purposeful**:
- Price change flash: 200ms highlight fade
- Connection pulse: Slow 2s pulse on status dots when active
- Loading skeletons: Gentle shimmer
- **No hover effects on hero buttons** (N/A for this dashboard app)