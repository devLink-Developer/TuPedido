"""category_visuals_v4

Revision ID: b2c4d6e8f101
Revises: 9d7c1a2e4b55
Create Date: 2026-03-25 16:20:00.000000

"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "b2c4d6e8f101"
down_revision: Union[str, None] = "9d7c1a2e4b55"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


DEFAULT_COLOR = "#9E9E9E"
DEFAULT_LIGHT = "#F2F2F2"
CATEGORY_PALETTE = {
    "despensa": {"color": "#FF7043", "color_light": "#FBE9E7", "icon": "DS"},
    "kiosko": {"color": "#29B6F6", "color_light": "#E1F5FE", "icon": "KS"},
    "farmacia": {"color": "#66BB6A", "color_light": "#E8F5E9", "icon": "FX"},
    "carniceria": {"color": "#EF5350", "color_light": "#FFEBEE", "icon": "CR"},
    "polleria": {"color": "#FFCA28", "color_light": "#FFF8E1", "icon": "PL"},
    "restaurante": {"color": "#AB47BC", "color_light": "#F3E5F5", "icon": "RT"},
}


def _inspector() -> sa.Inspector:
    return sa.inspect(op.get_bind())


def _has_table(table_name: str) -> bool:
    return table_name in _inspector().get_table_names()


def _has_column(table_name: str, column_name: str) -> bool:
    return column_name in {column["name"] for column in _inspector().get_columns(table_name)}


def upgrade() -> None:
    if not _has_table("categories"):
        return

    if not _has_column("categories", "color"):
        op.add_column(
            "categories",
            sa.Column("color", sa.String(length=7), nullable=False, server_default=DEFAULT_COLOR),
        )
    if not _has_column("categories", "color_light"):
        op.add_column("categories", sa.Column("color_light", sa.String(length=7), nullable=True))
    if not _has_column("categories", "icon"):
        op.add_column("categories", sa.Column("icon", sa.String(length=24), nullable=True))

    categories = sa.sql.table(
        "categories",
        sa.column("slug", sa.String()),
        sa.column("color", sa.String()),
        sa.column("color_light", sa.String()),
        sa.column("icon", sa.String()),
    )

    op.execute(
        categories.update()
        .where(sa.or_(categories.c.color.is_(None), categories.c.color == ""))
        .values(color=DEFAULT_COLOR)
    )
    op.execute(
        categories.update()
        .where(sa.or_(categories.c.color_light.is_(None), categories.c.color_light == ""))
        .values(color_light=DEFAULT_LIGHT)
    )

    for slug, values in CATEGORY_PALETTE.items():
        op.execute(
            categories.update()
            .where(categories.c.slug == slug)
            .values(
                color=values["color"],
                color_light=values["color_light"],
                icon=values["icon"],
            )
        )

def downgrade() -> None:
    if not _has_table("categories"):
        return
    if _has_column("categories", "icon"):
        op.drop_column("categories", "icon")
    if _has_column("categories", "color_light"):
        op.drop_column("categories", "color_light")
    if _has_column("categories", "color"):
        op.drop_column("categories", "color")
