# Book Flight

A mobile flight-booking application built with React Native and Expo, with flight search and airline integration powered by Appwrite Functions and Duffel.

Book Flight aims to provide a straightforward flight-booking experience, allowing customers to discover flights, compare available options, prepare passenger information, select optional services, and eventually complete and manage their bookings.

The initial product direction is **Nigeria-first, internationally capable**, with support for domestic and international travel.

## Project Status

Book Flight is actively under development.

The current implementation establishes the flight discovery and booking-preparation foundations.

### Currently implemented

- Flight search through Duffel API v2.
- One-way flight search with multiple passenger types.
- Adult, child, and infant passenger search.
- Cabin-class selection.
- Flight results and offer selection.
- Flight details and itinerary information.
- Offer freshness and price validation.
- Flight seat-map retrieval.
- Passenger-specific seat selection.
- Seat-service availability and price validation.
- Passenger information management.
- Passenger-provider identity mapping.
- Travel document requirement handling.
- Booking readiness validation.
- Booking-session management.

### Not yet implemented

- Payment processing.
- Airline order creation and confirmed reservations.
- Electronic ticket issuance.
- Persistent booking management.
- Booking cancellation and modifications.

These capabilities form part of the broader V1 product scope.

**Important:** Seat selection and validation do not reserve seats. A selected flight offer or seat is not a confirmed booking.

---

## Technology Stack

### Mobile application

| Technology          | Purpose                                 |
| ------------------- | --------------------------------------- |
| React Native        | Cross-platform mobile application       |
| Expo                | Development and application tooling     |
| TypeScript          | Application development and type safety |
| Expo Router         | File-based navigation                   |
| NativeWind          | Styling                                 |
| Zustand             | Client-side state management            |
| Lucide React Native | Icons                                   |

### Backend and integrations

| Technology         | Purpose                                 |
| ------------------ | --------------------------------------- |
| Appwrite Functions | Server-side integration boundary        |
| Duffel API v2      | Flight inventory, offers, and seat maps |
| Node.js            | Backend function runtime                |
| Native Fetch API   | HTTP communication                      |

### Testing

- Node.js built-in test runner.
- TSX for executing TypeScript tests.
- Mocked provider responses for backend integration tests.

---

## Architecture Overview

Book Flight uses a server-side integration boundary for communication with Duffel.

The mobile application must never communicate directly with Duffel or contain provider credentials.

### Flight search architecture

```text
┌──────────────────────────────┐
│       React Native App       │
│                              │
│  Flight Search               │
│  Flight Results              │
│  Flight Details              │
│  Passenger Management        │
│  Seat Selection              │
└──────────────┬───────────────┘
               │
               │ Appwrite Function Execution
               ▼
┌──────────────────────────────┐
│       Appwrite Backend       │
│                              │
│       Flight Search         │
│       Function               │
│                              │
│  - Request validation        │
│  - Provider communication    │
│  - Offer normalization       │
│  - Offer refresh             │
│  - Seat-map retrieval        │
│  - Seat-service validation   │
└──────────────┬───────────────┘
               │
               │ Duffel API v2
               ▼
┌──────────────────────────────┐
│          Duffel API          │
│                              │
│  Flight Offers               │
│  Itineraries                 │
│  Seat Maps                   │
│  Offer Availability          │
└──────────────────────────────┘
```

### Important architectural decisions

1. Duffel communication happens exclusively through Appwrite Functions.
2. The Duffel access token is stored as a server-side secret.
3. The mobile application communicates with Appwrite using the Appwrite Functions execution endpoint.
4. Provider responses are validated and normalized before being returned to the application.
5. Client-supplied offer and seat information is treated as untrusted comparison data during fresh validation.
6. Seat selection is optional and does not constitute a reservation.

---

## Getting Started

### Prerequisites

Before running the project, ensure you have:

- Node.js 22 or later.
- npm.
- Git.
- An Appwrite account and project.
- A Duffel account with an API access token.

For mobile development, you will also need the appropriate Android or iOS development environment.

### 1. Clone the repository

```bash
git clone https://github.com/kamtafw/book-flight.git

cd book-flight
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Create a `.env.local` file in the project root.

```dotenv
EXPO_PUBLIC_APPWRITE_ENDPOINT=https://cloud.appwrite.io/v1
EXPO_PUBLIC_APPWRITE_PROJECT_ID=your_appwrite_project_id
EXPO_PUBLIC_APPWRITE_FLIGHT_SEARCH_FUNCTION_ID=flight-search
```

Replace the placeholder values with the corresponding configuration from your Appwrite project.

These variables are used by the mobile application to identify the Appwrite endpoint, project, and flight-search function.

They do not contain the Duffel API credential.

**Never expose the Duffel access token through an `EXPO_PUBLIC_` environment variable.**

### 4. Configure the Appwrite Function

The repository contains the flight-search function at:

```text
functions/
└── flight-search/
    ├── package.json
    ├── README.md
    └── src/
        ├── main.js
        └── main.test.js
```

Create an Appwrite Function with the following configuration:

| Setting        | Value                                 |
| -------------- | ------------------------------------- |
| Name           | Flight Search                         |
| Function ID    | `flight-search`                       |
| Runtime        | Node.js 22 or supported newer runtime |
| Entrypoint     | `src/main.js`                         |
| Root directory | `functions/flight-search`             |
| Build command  | None required                         |

Configure the following environment variable in the Appwrite Function:

```dotenv
DUFFEL_ACCESS_TOKEN=your_duffel_access_token
```

Mark this variable as a secret.

The function uses Node.js's built-in `fetch` API and does not require additional runtime dependencies.

Configure an execution timeout of at least 60 seconds where supported, since flight searches can take several seconds to complete.

Deploy the function and ensure its execution permissions allow the intended application users to invoke it.

For detailed function configuration and request contracts, see:

`functions/flight-search/README.md`

### 5. Run the application

Start the Expo development server:

```bash
npm start
```

Alternatively, use the platform-specific commands:

#### Android

```bash
npm run android
```

#### iOS

```bash
npm run ios
```

#### Web

```bash
npm run web
```

After changing environment variables, restart the Expo development server.

---

## Project Structure

The project uses a feature-oriented structure under `src/`.

```text
book-flight/
│
├── src/
│   ├── app/
│   │   ├── (tabs)/
│   │   └── ...
│   │
│   ├── components/
│   │
│   ├── lib/
│   │   ├── flights/
│   │   │   ├── api.ts
│   │   │   └── types.ts
│   │   │
│   │   └── booking/
│   │       ├── passengers/
│   │       │   ├── passenger-domain.ts
│   │       │   └── providers/
│   │       │       └── duffel/
│   │       │
│   │       └── readiness/
│   │           ├── booking-readiness.ts
│   │           └── booking-session.ts
│   │
│   └── store/
│       └── flight-offers.store.ts
│
├── functions/
│   └── flight-search/
│       ├── package.json
│       ├── README.md
│       └── src/
│           ├── main.js
│           └── main.test.js
│
├── assets/
├── scripts/
│
├── app.json
├── package.json
├── tsconfig.json
├── babel.config.js
├── metro.config.js
└── tailwind.config.js
```

### Important directories

**`src/app/`**

Contains application screens and navigation routes managed by Expo Router.

**`src/components/`**

Contains reusable application components.

**`src/lib/flights/`**

Contains flight-related types and API integration logic. It handles communication with the Appwrite flight-search function.

**`src/lib/booking/passengers/`**

Contains the UI-independent passenger domain, passenger information handling, provider identity mapping, and Duffel-specific passenger validation.

**`src/lib/booking/readiness/`**

Contains booking preparation and readiness logic, including booking-session management.

**`src/store/`**

Contains application state management using Zustand.

**`functions/flight-search/`**

Contains the Appwrite Function responsible for communicating with Duffel and handling flight-search-related provider operations.

---

## Testing

The project includes automated tests covering important application and backend behaviour.

### Run the complete test suite

```bash
npm test
```

### Run individual test suites

#### Passenger domain

```bash
npm run test:passenger-domain
```

#### Passenger requirements

```bash
npm run test:passenger-requirements
```

#### Passenger validation

```bash
npm run test:passenger-validation
```

#### Booking readiness

```bash
npm run test:booking-readiness
```

#### Booking session

```bash
npm run test:booking-session
```

#### Flight search function

```bash
npm run test:flight-search
```

### Linting

Run the project's lint checks:

```bash
npm run lint
```

These tests primarily validate application logic, request validation, provider response handling, and booking-preparation behaviour.

They do not constitute end-to-end verification of a live airline booking or payment transaction.

---

## Development Guidelines

A few architectural constraints should be maintained as the project evolves.

### 1. Keep provider credentials server-side

Never expose Duffel credentials in the mobile application.

All Duffel API communication must go through the appropriate backend function.

### 2. Validate external data

Never assume that flight offers, passenger identities, seat availability, or prices remain valid indefinitely.

Use fresh provider validation at the appropriate stages of the booking journey.

### 3. Keep passenger logic independent of UI

Passenger-domain rules should remain separate from individual screens and form implementations.

Provider-specific requirements should be handled through the appropriate provider integration layer.

### 4. Treat seat selection as optional

The absence of seat availability must not prevent a customer from proceeding with an otherwise valid booking.

A selected seat is not a confirmed reservation.

### 5. Preserve transaction integrity

Future payment and booking implementations must account for asynchronous operations, uncertain outcomes, duplicate processing, and recovery.

Payment confirmation, reservation confirmation, and ticket issuance must be treated as distinct outcomes.

### 6. Keep implementation aligned with product scope

New features should be evaluated against the agreed V1 product scope before entering active development.

The objective is to build a reliable flight-booking product, not accumulate features without a defined completion target.

---

## Product Documentation

The following documentation provides additional context for the project's direction and implementation.

| Document                            | Purpose                                                                           |
| ----------------------------------- | --------------------------------------------------------------------------------- |
| `PRODUCT_SCOPE.md`                  | Defines the product vision, V1 capabilities, boundaries, and completion criteria. |
| `functions/flight-search/README.md` | Documents the Appwrite Function configuration and provider request contracts.     |

The product scope is the authoritative reference for evaluating new feature proposals and determining V1 completion.

---

## License

This project is currently under development. Licensing and distribution terms should be established before public distribution.
