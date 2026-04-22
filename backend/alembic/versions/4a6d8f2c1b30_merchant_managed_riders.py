"""merchant_managed_riders

Revision ID: 4a6d8f2c1b30
Revises: f3c1b8a9d204
Create Date: 2026-03-29 12:30:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "4a6d8f2c1b30"
down_revision: Union[str, None] = "a8d4e7c2b951"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _inspector() -> sa.Inspector:
    return sa.inspect(op.get_bind())


def _has_table(table_name: str) -> bool:
    return table_name in _inspector().get_table_names()


def _has_column(table_name: str, column_name: str) -> bool:
    return column_name in {column["name"] for column in _inspector().get_columns(table_name)}


def _has_index(table_name: str, index_name: str) -> bool:
    return index_name in {index["name"] for index in _inspector().get_indexes(table_name)}


def _has_foreign_key(table_name: str, constrained_columns: list[str], referred_table: str) -> bool:
    for foreign_key in _inspector().get_foreign_keys(table_name):
        if foreign_key.get("constrained_columns") != constrained_columns:
            continue
        if foreign_key.get("referred_table") != referred_table:
            continue
        return True
    return False


def _create_index(table_name: str, columns: list[str], *, unique: bool = False) -> None:
    index_name = op.f(f"ix_{table_name}_{'_'.join(columns)}")
    if not _has_index(table_name, index_name):
        op.create_index(index_name, table_name, columns, unique=unique)


def _drop_index(table_name: str, columns: list[str]) -> None:
    index_name = op.f(f"ix_{table_name}_{'_'.join(columns)}")
    if _has_table(table_name) and _has_index(table_name, index_name):
        op.drop_index(index_name, table_name=table_name)


def _drop_column(table_name: str, column_name: str) -> None:
    if _has_table(table_name) and _has_column(table_name, column_name):
        op.drop_column(table_name, column_name)


def _ensure_nullable_fk_column(table_name: str, column_name: str, referred_table: str) -> None:
    if op.get_bind().dialect.name == "sqlite":
        needs_column = not _has_column(table_name, column_name)
        needs_fk = not _has_foreign_key(table_name, [column_name], referred_table)
        if needs_column or needs_fk:
            with op.batch_alter_table(table_name, recreate="always") as batch_op:
                if needs_column:
                    batch_op.add_column(sa.Column(column_name, sa.Integer(), nullable=True))
                if needs_fk:
                    batch_op.create_foreign_key(
                        f"fk_{table_name}_{column_name}_{referred_table}",
                        referred_table,
                        [column_name],
                        ["id"],
                        ondelete="SET NULL",
                    )
        return

    if not _has_column(table_name, column_name):
        op.add_column(
            table_name,
            sa.Column(column_name, sa.Integer(), sa.ForeignKey(f"{referred_table}.id", ondelete="SET NULL"), nullable=True),
        )


def upgrade() -> None:
    if _has_table("store_delivery_settings"):
        if not _has_column("store_delivery_settings", "free_delivery_min_order"):
            op.add_column(
                "store_delivery_settings",
                sa.Column("free_delivery_min_order", sa.Numeric(precision=10, scale=2), nullable=True),
            )
        if not _has_column("store_delivery_settings", "rider_fee"):
            op.add_column(
                "store_delivery_settings",
                sa.Column("rider_fee", sa.Numeric(precision=10, scale=2), nullable=False, server_default="0"),
            )
        op.execute(sa.text("UPDATE store_delivery_settings SET rider_fee = COALESCE(rider_fee, 0)"))
        if op.get_bind().dialect.name != "sqlite":
            op.alter_column("store_delivery_settings", "rider_fee", server_default=None)

    if _has_table("delivery_applications"):
        _ensure_nullable_fk_column("delivery_applications", "store_id", "stores")
    _create_index("delivery_applications", ["store_id"])

    if _has_table("delivery_profiles"):
        _ensure_nullable_fk_column("delivery_profiles", "store_id", "stores")
    _create_index("delivery_profiles", ["store_id"])

    if _has_table("rider_settlement_payments"):
        _ensure_nullable_fk_column("rider_settlement_payments", "store_id", "stores")
    _create_index("rider_settlement_payments", ["store_id"])

    if _has_table("delivery_profiles"):
        op.execute(
            sa.text(
                """
                UPDATE delivery_profiles
                SET is_active = FALSE,
                    availability = 'offline'
                WHERE store_id IS NULL
                """
            )
        )


def downgrade() -> None:
    _drop_index("rider_settlement_payments", ["store_id"])
    _drop_index("delivery_profiles", ["store_id"])
    _drop_index("delivery_applications", ["store_id"])

    for table_name, column_name in (
        ("rider_settlement_payments", "store_id"),
        ("delivery_profiles", "store_id"),
        ("delivery_applications", "store_id"),
        ("store_delivery_settings", "rider_fee"),
        ("store_delivery_settings", "free_delivery_min_order"),
    ):
        _drop_column(table_name, column_name)
