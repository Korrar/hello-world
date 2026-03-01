"""
Dedicated import service for Intiaro PIM API data.
Creates a Product with all related Intiaro-specific models.
"""
from typing import Any

from sqlalchemy.orm import Session

from app.models.product import (
    Product, Category, ProductConfiguration, ConfigurationOption,
)
from app.models.intiaro import (
    ProductFeatures, RenderSettings, VariableGroup, ChoiceGroup,
    ProductPredicate, ProductEvent, SectionalElement, MenuSettings,
    AttributeMapping, DefaultConfiguration,
)
from app.services.intiaro_mapper import (
    map_product_base, map_category, map_product_features,
    map_render_settings, map_variable_groups, map_choice_groups,
    map_attributes, map_choices, map_predicates, map_events,
    collect_event_predicate_keys,
    map_sectional_elements, map_menu_settings, map_attribute_mappings,
    map_default_configurations,
)


def _get_or_create_category(db: Session, name: str) -> Category:
    name = name.strip()
    cat = db.query(Category).filter(Category.name == name).first()
    if not cat:
        cat = Category(name=name)
        db.add(cat)
        db.flush()
    return cat


def _clear_intiaro_relations(db: Session, product: Product):
    """Remove all existing Intiaro-related data for a product before re-import."""
    # Clear 1:1 relations
    if product.features:
        db.delete(product.features)
    if product.render_settings:
        db.delete(product.render_settings)
    if product.menu_settings:
        db.delete(product.menu_settings)

    # Clear 1:M relations
    for item in product.variable_groups:
        db.delete(item)
    for item in product.choice_groups:
        db.delete(item)
    for item in product.predicates:
        db.delete(item)
    for item in product.events:
        db.delete(item)
    for item in product.sectional_elements:
        db.delete(item)
    for item in product.attribute_mappings:
        db.delete(item)
    for item in product.default_configurations:
        db.delete(item)

    # Clear configurations and their options
    for cfg in product.configurations:
        db.delete(cfg)

    db.flush()


def import_intiaro_product(db: Session, data: dict[str, Any]) -> dict[str, Any]:
    """Import a single Intiaro product instance into the database.

    Args:
        db: Database session
        data: Raw JSON data from Intiaro PIM API (single product_instance)

    Returns:
        Import report dict
    """
    report = {
        "product_id": 0,
        "product_name": "",
        "sku": "",
        "configurations_count": 0,
        "options_count": 0,
        "variable_groups_count": 0,
        "choice_groups_count": 0,
        "predicates_count": 0,
        "events_count": 0,
        "sectional_elements_count": 0,
        "has_render_settings": False,
        "has_product_features": False,
        "has_menu_settings": False,
        "attribute_mappings_count": 0,
        "default_configurations_count": 0,
        "errors": [],
    }

    try:
        # 1. Map base product fields
        product_fields = map_product_base(data)
        sku = product_fields.get("sku", "")
        if not sku:
            report["errors"].append("Missing SKU (client_identifier or id)")
            return report

        report["sku"] = sku
        report["product_name"] = product_fields.get("name", "")

        # 2. Find or create product
        product = db.query(Product).filter(Product.sku == sku).first()
        if product:
            # Update existing — clear old Intiaro data
            _clear_intiaro_relations(db, product)
            for k, v in product_fields.items():
                if v is not None:
                    setattr(product, k, v)
        else:
            product = Product(**product_fields)
            db.add(product)
            db.flush()

        report["product_id"] = product.id

        # 3. Category
        cat_name = map_category(data)
        if cat_name:
            cat = _get_or_create_category(db, cat_name)
            product.categories = [cat]

        # 4. Product Features
        features_data = map_product_features(data)
        if features_data:
            features = ProductFeatures(product_id=product.id, **features_data)
            db.add(features)
            report["has_product_features"] = True

        # 5. Render Settings
        rs_data = map_render_settings(data)
        if rs_data:
            rs = RenderSettings(product_id=product.id, **rs_data)
            db.add(rs)
            report["has_render_settings"] = True

        # 6. Variable Groups
        vg_list = map_variable_groups(data)
        for vg_data in vg_list:
            vg = VariableGroup(product_id=product.id, **vg_data)
            db.add(vg)
        report["variable_groups_count"] = len(vg_list)

        # 7. Choice Groups
        cg_list = map_choice_groups(data)
        for cg_data in cg_list:
            cg = ChoiceGroup(product_id=product.id, **cg_data)
            db.add(cg)
        report["choice_groups_count"] = len(cg_list)

        # 8. Attributes → ProductConfiguration
        attr_list = map_attributes(data)

        # 9. Choices → ConfigurationOption (needs attr_list for matching)
        choices_by_attr = map_choices(data, attr_list)

        total_options = 0
        for attr_data in attr_list:
            # Remove internal field before creating model
            attr_slug = attr_data.get("slug", "")
            attr_data.pop("_available_choices", None)

            config = ProductConfiguration(product_id=product.id, **attr_data)
            db.add(config)
            db.flush()

            # Add matched options
            options_data = choices_by_attr.get(attr_slug, [])
            for opt_data in options_data:
                option = ConfigurationOption(configuration_id=config.id, **opt_data)
                db.add(option)
                total_options += 1

        report["configurations_count"] = len(attr_list)
        report["options_count"] = total_options

        # 10. Collect event predicate keys (before predicates, so we can exclude them)
        event_pred_keys = collect_event_predicate_keys(data)

        # 11. Predicates (cross-referenced with attributes & choices, excluding event predicates)
        pred_list = map_predicates(data, attr_list, choices_by_attr, exclude_keys=event_pred_keys)
        for pred_data in pred_list:
            pred = ProductPredicate(product_id=product.id, **pred_data)
            db.add(pred)
        report["predicates_count"] = len(pred_list)

        # 12. Events (with resolved predicate conditions)
        event_list = map_events(data)
        for ev_data in event_list:
            ev = ProductEvent(product_id=product.id, **ev_data)
            db.add(ev)
        report["events_count"] = len(event_list)

        # 13. Sectional Elements
        elem_list = map_sectional_elements(data)
        for elem_data in elem_list:
            elem = SectionalElement(product_id=product.id, **elem_data)
            db.add(elem)
        report["sectional_elements_count"] = len(elem_list)

        # 14. Menu Settings
        ms_data = map_menu_settings(data)
        if ms_data:
            ms = MenuSettings(product_id=product.id, **ms_data)
            db.add(ms)
            report["has_menu_settings"] = True

        # 15. Attribute Mappings
        am_list = map_attribute_mappings(data)
        for am_data in am_list:
            am = AttributeMapping(product_id=product.id, **am_data)
            db.add(am)
        report["attribute_mappings_count"] = len(am_list)

        # 16. Default Configurations
        dc_list = map_default_configurations(data)
        for dc_data in dc_list:
            dc = DefaultConfiguration(product_id=product.id, **dc_data)
            db.add(dc)
        report["default_configurations_count"] = len(dc_list)

        # 17. Auto-generate default config from default_choice if not provided
        has_default = any(d.get("config_type") == "default" for d in dc_list)
        if not has_default and attr_list:
            default_vars: dict[str, str] = {}
            for attr_data in attr_list:
                slug = attr_data.get("slug", "")
                default_val = attr_data.get("default_choice", "")
                if slug and default_val:
                    default_vars[slug] = default_val
                elif slug:
                    # Fallback: first option for this attribute
                    opts = choices_by_attr.get(slug, [])
                    if opts:
                        default_vars[slug] = opts[0].get("slug") or opts[0].get("value", "")
            if default_vars:
                dc = DefaultConfiguration(
                    product_id=product.id,
                    config_type="default",
                    elements={"configuration": {"variables": default_vars}},
                )
                db.add(dc)
                report["default_configurations_count"] += 1

        db.commit()

    except Exception as e:
        db.rollback()
        report["errors"].append(str(e))

    return report
