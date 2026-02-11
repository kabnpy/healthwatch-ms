# Technology Stack

## Backend
- **Language:** Python 3.10+
- **Framework:** [FastAPI](https://fastapi.tiangolo.com)
- **ORM:** [SQLModel](https://sqlmodel.tiangolo.com) (SQLAlchemy + Pydantic)
- **Database:** [PostgreSQL](https://www.postgresql.org)
- **Migrations:** [Alembic](https://alembic.sqlalchemy.org)
- **Data Validation:** [Pydantic](https://docs.pydantic.dev)
- **Security:** JWT authentication, Argon2/Bcrypt password hashing
- **Testing:** [Pytest](https://pytest.org), Coverage.py

## Frontend
- **Language:** TypeScript
- **Framework:** [React 19](https://react.dev) with [Vite](https://vitejs.dev)
- **Routing:** [TanStack Router](https://tanstack.com/router)
- **Data Fetching:** [TanStack Query](https://tanstack.com/query)
- **Styling:** [Tailwind CSS](https://tailwindcss.com) and [shadcn/ui](https://ui.shadcn.com)
- **Icons:** [Lucide React](https://lucide.dev)
- **API Client:** [@hey-api/openapi-ts](https://github.com/hey-api/openapi-ts) for automated SDK generation
- **Testing:** [Playwright](https://playwright.dev) for E2E testing

## Infrastructure & Tools
- **Containerization:** [Docker Compose](https://docs.docker.com/compose)
- **Reverse Proxy:** [Traefik](https://traefik.io)
- **CI/CD:** GitHub Actions
- **Development Tools:** Bun (for frontend package management)
