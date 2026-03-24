import asyncio

from app.services.delivery_jobs import run_delivery_maintenance_loop


def main() -> None:
    asyncio.run(run_delivery_maintenance_loop())


if __name__ == "__main__":
    main()
