"""
Mapper functions for converting Intiaro PIM API data to internal models.
Each top-level key from the API has a dedicated mapping function.
"""
from typing import Any


def map_product_base(data: dict[str, Any]) -> dict[str, Any]:
    """Map top-level Intiaro fields to Product model fields."""
    status = data.get("status", "")
    is_active = status == "published" if status else True

    return {
        "sku": str(data.get("client_identifier") or data.get("id", "")),
        "name": data.get("product_name", ""),
        "manufacturer": data.get("tenant", ""),
        "thumbnail_url": data.get("product_thumbnail", ""),
        "is_active": is_active,
        "intiaro_id": data.get("id"),
        "intiaro_product_id": data.get("product_id"),
        "product_system_version": str(data.get("product_system_version", "")) or None,
        "sectional_builder": bool(data.get("sectional_builder", False)),
    }


def map_category(data: dict[str, Any]) -> str | None:
    """Extract category name from Intiaro data."""
    cat = data.get("product_category")
    if cat and isinstance(cat, str) and cat.strip():
        return cat.strip()
    return None


def map_product_features(data: dict[str, Any]) -> dict[str, Any] | None:
    """Map feature flags and product_features dict to ProductFeatures fields."""
    pf = data.get("product_features", {}) or {}
    high_res = pf.get("high_resolution_picture", {}) or {}

    has_any = any([
        data.get("web_gltf"), data.get("web_usdz"), data.get("web_360"),
        data.get("app_ar"), data.get("download3d"), data.get("com"),
        data.get("has_measurements"), pf,
    ])
    if not has_any:
        return None

    return {
        "web_gltf": bool(data.get("web_gltf", False)),
        "web_usdz": bool(data.get("web_usdz", False)),
        "web_360": bool(data.get("web_360", False)),
        "app_ar": bool(data.get("app_ar", False)),
        "download3d": bool(data.get("download3d", False)),
        "com": bool(data.get("com", False)),
        "has_measurements": bool(data.get("has_measurements", False)),
        "resolution_x": high_res.get("x") or high_res.get("width"),
        "resolution_y": high_res.get("y") or high_res.get("height"),
        "supported_formats": pf.get("supported_model_formats"),
    }


def map_render_settings(data: dict[str, Any]) -> dict[str, Any] | None:
    """Map render_settings dict to RenderSettings fields."""
    rs = data.get("render_settings")
    if not rs or not isinstance(rs, dict):
        return None

    rotate = rs.get("rotate", {}) or {}
    tile = rs.get("tile", {}) or {}
    zoom = rs.get("zoom", {}) or {}

    return {
        "rotate_size_x": rotate.get("x") or rotate.get("width"),
        "rotate_size_y": rotate.get("y") or rotate.get("height"),
        "tile_size_x": tile.get("x") or tile.get("width"),
        "tile_size_y": tile.get("y") or tile.get("height"),
        "zoom_size_x": zoom.get("x") or zoom.get("width"),
        "zoom_size_y": zoom.get("y") or zoom.get("height"),
        "shadow_enabled": bool(rs.get("shadow", False)),
    }


def map_variable_groups(data: dict[str, Any]) -> list[dict[str, Any]]:
    """Map variable_groups list to VariableGroup fields."""
    groups = data.get("variable_groups")
    if not groups or not isinstance(groups, list):
        return []

    result = []
    for g in groups:
        if not isinstance(g, dict):
            continue
        result.append({
            "name": g.get("name", ""),
            "slug": g.get("slug", ""),
            "icon": g.get("icon", ""),
            "icon_selected": g.get("icon_selected", ""),
            "color": g.get("color", ""),
            "index": g.get("index", 0),
            "priority": g.get("priority", 0),
            "description": g.get("description", ""),
        })
    return result


def map_choice_groups(data: dict[str, Any]) -> list[dict[str, Any]]:
    """Map choice_groups list to ChoiceGroup fields."""
    groups = data.get("choice_groups")
    if not groups or not isinstance(groups, list):
        return []

    result = []
    for g in groups:
        if not isinstance(g, dict):
            continue
        result.append({
            "name": g.get("name", ""),
            "slug": g.get("slug", ""),
            "index": g.get("index", 0),
        })
    return result


def map_attributes(data: dict[str, Any]) -> list[dict[str, Any]]:
    """Map Intiaro 'attributes' list to ProductConfiguration fields.
    Each attribute becomes a ProductConfiguration with enriched Intiaro fields.
    """
    attributes = data.get("attributes")
    if not attributes or not isinstance(attributes, list):
        return []

    result = []
    for idx, attr in enumerate(attributes):
        if not isinstance(attr, dict):
            continue

        # Extract search/filter/sorting configs
        search_cfg = attr.get("search")
        filters_cfg = attr.get("filters")
        sorting_cfg = attr.get("sorting")

        # Map application_methods
        app_methods = attr.get("application_methods")

        # Map available_choices_tags
        choices_tags = attr.get("available_choices_tags")

        result.append({
            "name": attr.get("name", ""),
            "display_name": attr.get("display_name") or attr.get("name", ""),
            "config_type": _map_config_type(attr.get("type", "choice")),
            "sort_order": idx,
            "slug": attr.get("slug", ""),
            "group": attr.get("group", ""),
            "attribute_type": attr.get("type", ""),
            "variable_group": attr.get("variable_group", ""),
            "visibility": attr.get("visibility", ""),
            "always_on": bool(attr.get("always_on", False)),
            "is_com": bool(attr.get("is_com", False)),
            "predicate": attr.get("predicate", ""),
            "display_text": attr.get("display_text", ""),
            "dynamic_local_menu": bool(attr.get("dynamic_local_menu", False)),
            "application_methods": app_methods if app_methods else None,
            "available_choices_tags": choices_tags if choices_tags else None,
            "search": search_cfg if search_cfg else None,
            "filters": filters_cfg if filters_cfg else None,
            "sorting": sorting_cfg if sorting_cfg else None,
            "default_choice": attr.get("default_choice", ""),
            # Store the original available_choices for matching
            "_available_choices": attr.get("available_choices", []),
        })
    return result


def _choice_to_option(ch: dict[str, Any], idx: int, default_choice: str) -> dict[str, Any]:
    """Convert a raw Intiaro choice dict into a ConfigurationOption dict."""
    return {
        "value": ch.get("slug", ""),
        "display_name": ch.get("name", "") or ch.get("slug", ""),
        "slug": ch.get("slug", ""),
        "sort_order": idx,
        "thumbnail_url": ch.get("thumbnail", "") or ch.get("icon", ""),
        "choice_group": ch.get("choice_group", ""),
        "tags": ch.get("tags") if ch.get("tags") else None,
        "icon": ch.get("icon", ""),
        "grade": ch.get("grade", ""),
        "predicate": ch.get("predicate", ""),
        "texture_data": ch.get("texture") if ch.get("texture") else None,
        "choice_attributes": ch.get("choice_attributes") if ch.get("choice_attributes") else None,
        "element_id": ch.get("element_id"),
        "is_default": ch.get("slug", "") == default_choice,
    }


def map_choices(
    data: dict[str, Any],
    mapped_attributes: list[dict[str, Any]],
) -> dict[str, list[dict[str, Any]]]:
    """Map Intiaro 'choices' list to ConfigurationOption fields.
    Returns a dict keyed by attribute slug → list of option dicts.

    Matching strategy (per attribute):
    1. If _available_choices has explicit slugs → use those
    2. Otherwise if available_choices_tags is set → match choices whose
       tags intersect with the attribute's available_choices_tags
    """
    choices = data.get("choices")
    if not choices or not isinstance(choices, list):
        return {}

    # Build a lookup: choice slug → choice data
    choice_by_slug: dict[str, dict] = {}
    for ch in choices:
        if not isinstance(ch, dict):
            continue
        slug = ch.get("slug", "")
        if slug:
            choice_by_slug[slug] = ch

    # For each attribute, find matching choices
    result: dict[str, list[dict[str, Any]]] = {}
    for attr in mapped_attributes:
        attr_slug = attr.get("slug", "")
        available = attr.get("_available_choices", [])
        default_choice = attr.get("default_choice", "")

        options: list[dict[str, Any]] = []

        if available:
            # Strategy 1: explicit slug list
            for idx, choice_slug in enumerate(available):
                ch = choice_by_slug.get(choice_slug)
                if not ch:
                    options.append({
                        "value": choice_slug,
                        "display_name": choice_slug,
                        "slug": choice_slug,
                        "sort_order": idx,
                    })
                    continue
                options.append(_choice_to_option(ch, idx, default_choice))
        else:
            # Strategy 2: match via tags
            attr_tags = attr.get("available_choices_tags") or []
            if attr_tags:
                attr_tag_set = set(attr_tags)
                idx = 0
                for ch in choices:
                    if not isinstance(ch, dict):
                        continue
                    choice_tags = ch.get("tags")
                    if not choice_tags or not isinstance(choice_tags, list):
                        continue
                    if attr_tag_set.intersection(choice_tags):
                        options.append(_choice_to_option(ch, idx, default_choice))
                        idx += 1

        result[attr_slug] = options
    return result


def map_predicates(data: dict[str, Any]) -> list[dict[str, Any]]:
    """Map Intiaro 'predicates' dict to ProductPredicate fields."""
    predicates = data.get("predicates")
    if not predicates or not isinstance(predicates, dict):
        return []

    result = []
    for key, pred in predicates.items():
        if not isinstance(pred, dict):
            continue
        result.append({
            "predicate_key": str(key),
            "name": pred.get("name", ""),
            "type": pred.get("type", ""),
            "attribute": pred.get("attribute", ""),
            "operator": pred.get("operator", ""),
            "compare_to": str(pred.get("compare_to", "")) if pred.get("compare_to") is not None else "",
        })
    return result


def map_events(data: dict[str, Any]) -> list[dict[str, Any]]:
    """Map Intiaro 'events' dict to ProductEvent fields."""
    events = data.get("events")
    if not events or not isinstance(events, dict):
        return []

    result = []
    # events can be structured as {event_type: {source: [destinations]}}
    for event_type, event_data in events.items():
        if not isinstance(event_data, dict):
            continue
        for source, destinations in event_data.items():
            result.append({
                "event_type": event_type,
                "source_variable": source,
                "destinations": destinations if isinstance(destinations, list) else [destinations],
            })
    return result


def map_sectional_elements(data: dict[str, Any]) -> list[dict[str, Any]]:
    """Map Intiaro 'elements', 'elements_default', 'elements_includes',
    'elements_positions' to SectionalElement fields.
    """
    elements = data.get("elements")
    elements_default = data.get("elements_default", {}) or {}
    elements_includes = data.get("elements_includes", {}) or {}
    elements_positions = data.get("elements_positions", {}) or {}

    if not elements and not elements_default:
        return []

    # Build from 'elements' list if available
    result = []
    if elements and isinstance(elements, list):
        for elem in elements:
            if not isinstance(elem, dict):
                continue
            eid = elem.get("id") or elem.get("element_id")
            eid_str = str(eid) if eid is not None else ""
            result.append({
                "element_id": int(eid) if eid is not None else None,
                "name": elem.get("name", ""),
                "file_id": str(elem.get("file_id", "")) if elem.get("file_id") else None,
                "default_variables": elements_default.get(eid_str),
                "includes": elements_includes.get(eid_str),
                "positions": elements_positions.get(eid_str),
            })
    elif elements_default and isinstance(elements_default, dict):
        # Fallback: build from elements_default keys
        for eid_str, defaults in elements_default.items():
            try:
                eid = int(eid_str)
            except (ValueError, TypeError):
                eid = None
            result.append({
                "element_id": eid,
                "name": "",
                "file_id": None,
                "default_variables": defaults,
                "includes": elements_includes.get(eid_str),
                "positions": elements_positions.get(eid_str),
            })

    return result


def map_menu_settings(data: dict[str, Any]) -> dict[str, Any] | None:
    """Map Intiaro 'menu_settings' to MenuSettings fields."""
    ms = data.get("menu_settings")
    if not ms or not isinstance(ms, dict):
        return None

    return {
        "name": ms.get("name", ""),
        "hidden_attributes": ms.get("hidden_attributes") or ms.get("hidden", []),
    }


def map_attribute_mappings(data: dict[str, Any]) -> list[dict[str, Any]]:
    """Map Intiaro 'applyToAttributesMapping' list to AttributeMapping fields."""
    mappings = data.get("applyToAttributesMapping")
    if not mappings or not isinstance(mappings, list):
        return []

    result = []
    for m in mappings:
        if not isinstance(m, dict):
            continue
        result.append({
            "source_attribute": m.get("source") or m.get("from", ""),
            "target_attributes": m.get("targets") or m.get("to", []),
        })
    return result


def map_default_configurations(data: dict[str, Any]) -> list[dict[str, Any]]:
    """Map default_configuration and entry_default_configuration."""
    result = []

    dc = data.get("default_configuration")
    if dc and isinstance(dc, dict):
        result.append({
            "config_type": "default",
            "elements": dc,
        })

    edc = data.get("entry_default_configuration")
    if edc and isinstance(edc, dict):
        result.append({
            "config_type": "entry_default",
            "elements": edc,
        })

    return result


def _map_config_type(intiaro_type: str) -> str:
    """Map Intiaro attribute type to internal config_type."""
    mapping = {
        "choice": "select",
        "texture": "material",
        "color": "color",
        "sections": "select",
    }
    return mapping.get(intiaro_type, "select")
