import { $ } from '../jquery.js';
import { simpleParse, buildAttributesData, extractOrderedAttributes, getUuid, getFullTitle, cleanAttributes } from '../utils/functions.js';
import { Base64 } from '../utils/base64.js';
import { LD_TYPE_CELEX } from '../manager/index.js';
import { buildEliLabel, buildForceLabel, buildForceStatus, buildOjLabel, buildTitleLabel, buildDate } from './lib/tooltip.js';
import { R2L } from '../index.js';
import { LD_MODE_METADATA } from '../settings/index.js';
import { extractLinkedDataIds, extractLinkedDataId, extractLinkedDataType } from '../utils/data.js';

const TOOLTIP_CLASS = ".ref2link-tooltip";

export function orderSorter(left, right) {
    // common rules always go last
    if (left.common && !right.common) {
        return 1;
    }
    if (!left.common && right.common) {
        return -1;
    }

    return left.order - right.order;
};

let alternativesUnion = function (left, right) {
    var viewKeys = {},
        alternativeWalker = function (_value) {
            var viewKey = [_value.match, _value.rule.type, _value.view].join('-----');
            if (viewKeys.hasOwnProperty(viewKey)) {
                return;
            }

            viewKeys[viewKey] = _value;
        };

    left.forEach(alternativeWalker);
    right.forEach(alternativeWalker);

    return $.map(viewKeys, function (alternative) {
        return alternative;
    }).sort(orderSorter);
};

let stopEvent = function (ev) {
    ev.preventDefault();
    ev.stopPropagation();
    ev.stopImmediatePropagation();
    return false;
};

export function resetTooltips() {
    //reinitialize tooltips
    $(R2L.settings.class).data('tooltip', null);
    $(TOOLTIP_CLASS).remove();
}

export function hideTooltipHandler(e) {
    $(document).find(TOOLTIP_CLASS).each((index, el) => {
        $(el).removeAttr('data-state').hide();
    });
};

export function repositionTooltipHandler($el, $tooltip) {
    var zIndex = 1,
        offset = $el.offset();
    $el.parents().each(function () {
        zIndex = Math.max(parseInt($(this).css('z-index').replace(/\D+/g, ''), 10) || 1, zIndex);
    });

    // find optimal position to place the element

    let scrollTop = $(window).scrollTop();
    let scrollLeft = $(window).scrollLeft();
    let distanceTop = offset.top - scrollTop;
    let distanceBottom = window.innerHeight - distanceTop + $el[0].offsetHeight;
    let distanceLeft = offset.left - scrollLeft;
    let distanceRight = window.innerWidth - distanceLeft;

    setTimeout(() => {

        // by default it goes towards the right of the page, starting at the same left offset
        let left = distanceLeft;
        // if no room we show it on the left part
        if ($tooltip.outerWidth() > distanceRight && $tooltip.outerWidth() <= distanceLeft) {
            left -= ($tooltip.outerWidth() - $el.outerWidth());
        }

        let top = distanceTop + $el.outerHeight();
        let spacing = R2L.viewOptions.bottomSpacing || 60;
        // by default it goes below the element, unless there is no room
        if ($tooltip.outerHeight() > (distanceBottom - spacing) && $tooltip.outerHeight() <= distanceTop) {
            top -= ($tooltip.outerHeight() + $el.outerHeight());
        }

        $tooltip.css({
            zIndex: zIndex + 100,
            top: top,
            left: left,
            visibility: 'visible'
        });
    }, 1);
};

export let positionHandler = function () {
    $(TOOLTIP_CLASS).each(function () {
        var $tooltip = $(this),
            $el = $tooltip.data('ref2link');
        repositionTooltipHandler($el, $tooltip);
    });
};

/**
 * Rules with multiple CELEX attributes also have multiple linked-data bindings. This function will load an id on the fly if * another target has been selected.
 * @param {String} linkedDataId 
 * @param {String} linkedDataType
 * 
 * @return {Promise<Binding>} 
 */
function loadMetadata(linkedDataId, linkedDataType) {
    return new Promise((resolve, reject) => {
        let currentBinding = (linkedDataId) ? R2L.ldm.getMetadataById(linkedDataId) : null;

        // no support for other linked data types reloading other than CELEX
        if (linkedDataType !== LD_TYPE_CELEX || !R2L.options.metadata || !R2L.hasLinkedDataMode(LD_MODE_METADATA)) {
            resolve(currentBinding);
            return;
        }

        if (currentBinding) {
            resolve(currentBinding);
            return;
        }
        else {
            let linkedDataIds = extractLinkedDataIds([]);
            linkedDataIds[linkedDataType] = [linkedDataId];

            R2L.ldm.fetch([], linkedDataIds).then((_) => {
                console.log("Done fetching data");
                resolve(R2L.ldm.getMetadataById(linkedDataId));
            }).catch((err) => {
                resolve(null);
                console.error(err);
            });
        }
    })
}
export function showTooltipHandler(ev, $target) {
    $target = $target || $(ev.target);

    let $tooltip;
    // min number of targets to use grouping. When disable we set the value very large
    const GROUP_TARGET_MIN = R2L.viewOptions.useTargetGrouping ? 2 : 10000000;

    if ($target.attr('title')) {
        $target.data('_title', $target.attr('title'));
    }

    if (R2L.options.tooltipTrigger === 'notooltip') {
        $target.attr('title', $target.data('_title'));
        return;
    }

    var $self = $target.closest(R2L.settings.class + ', ' + TOOLTIP_CLASS).parents(R2L.settings.class + ', ' + TOOLTIP_CLASS).last();
    if (!$self.length) {
        $self = $target.closest(R2L.settings.class + ', ' + TOOLTIP_CLASS);
    }

    if ($self.is(TOOLTIP_CLASS)) {
        $self = $self.data('ref2link');
        $tooltip = $self.data('tooltip');
    }

    let ref2link = $self.getRef2linkMatch();
    if (!ref2link.alternatives) {
        return;
    }

    $tooltip = $self.data('tooltip');

    let alternatives = alternativesUnion(ref2link.alternatives, []);
    if (alternatives.length < 1 && 'view' == (R2L.options.mode || R2L.viewOptions.mode)) {
        return;
    }

    alternatives.sort(orderSorter);
    hideTooltipHandler();

    if ($tooltip && $tooltip.length && $tooltip[0] && $tooltip[0].ownerDocument.body.contains($tooltip[0])) {
        $target.removeAttr('title');
        $tooltip.attr('data-state', 'active');
        $tooltip.show();
        repositionTooltipHandler($self, $tooltip);
        return;
    }

    ref2link = Object.assign({}, ref2link);

    $tooltip = $(simpleParse(R2L.options.tooltip || R2L.viewOptions.tooltip, ref2link));
    var $table = $tooltip.find('.table');

    var lastRule = null,
        lastMatch = null,
        renderedViews = [],
        hasRows = false;

    let attributesList = extractOrderedAttributes(ref2link.alternatives);
    let attributes = buildAttributesData(attributesList);

    let groups = {};

    // REFTOLINK-1974 get attributes from selected view (lazy-load)
    let currentViewAttributes = {};
    $($self[0].attributes).each(function (index, el) {
        // skip nulls, non-data attributes        
        if (el.nodeName.slice(0, 4) !== 'data') {
            return;
        }
        if (!el.value || el.value === "null") {
            return;
        }

        currentViewAttributes[el.nodeName] = el.value;
    });

    let currentViewLinkedDataId = extractLinkedDataId(currentViewAttributes);
    let currentViewLinkedDataType = extractLinkedDataType(currentViewAttributes);

    loadMetadata(currentViewLinkedDataId, currentViewLinkedDataType).then((globalBinding) => {

        alternatives.forEach(function (_alternative) {
            if (_alternative.viewName === "table") {
                return;
            }

            var viewKey = [_alternative.rule.ruleLibelle, _alternative.view].join('-----');
            if (renderedViews.indexOf(viewKey) >= 0) {
                return;
            }
            var tpl, groupTpl, $row,
                $view = $(_alternative.view),
                $viewLink = $view.is(R2L.settings.classSimple) ? $view : $view.find(R2L.settings.classSimple);

            if (!lastMatch) {
                lastMatch = _alternative.reference;
            }

            let linkedDataId = extractLinkedDataId(attributes);
            let renderedLinkedData = false;

            if (!globalBinding) {
                let binding = (linkedDataId) ? R2L.ldm.getMetadataById(linkedDataId) : null;
                globalBinding = binding;
            }
            else {
                linkedDataId = currentViewLinkedDataId;
            }


            if (_alternative.rule.ruleLibelle !== lastRule) {
                tpl = (R2L.options.ruleHeading || R2L.viewOptions.ruleHeading);
                if (!renderedLinkedData && globalBinding) {
                    // make sure all data is sanitized and safe to be injected into the HTML
                    $row = $(simpleParse(tpl, {
                        ruleLibelle: _alternative.rule.ruleLibelle,
                        match: ref2link.reference,
                        status: R2L.ldm.getStatus(),
                        forceStatus: buildForceStatus(globalBinding),
                        forceLabel: buildForceLabel(globalBinding),
                        title: buildTitleLabel(globalBinding, ref2link.reference, linkedDataId),
                        date: buildDate(globalBinding),
                        oj: buildOjLabel(globalBinding),
                        eli: buildEliLabel(globalBinding)
                    }));
                    $table.append($row);
                    renderedLinkedData = true;
                }
                lastRule = _alternative.rule.ruleLibelle;
            }

            tpl = (R2L.options.rule || R2L.viewOptions.rule);
            groupTpl = (R2L.options.groupRule || R2L.viewOptions.groupRule);

            var title = $viewLink.attr('title');
            var href = $viewLink.attr('href') || $viewLink.find("a").attr('href');
            var selfHref = $self.attr('href') || $self.find("a").attr('href');
            if (!title) {
                return;
            }

            let groupTitleWithPrefix = getFullTitle(title, _alternative.groupTarget);

            hasRows = _alternative;
            let counter = alternatives.filter(a => a.groupTarget === _alternative.groupTarget).length;

            $row = $(simpleParse(tpl, {
                title: (_alternative.groupTarget && counter < GROUP_TARGET_MIN) ? (groupTitleWithPrefix) : title,
                href: href,
                group: (_alternative.groupTarget && counter >= GROUP_TARGET_MIN) ? (_alternative.groupTarget) : ""
            }));

            $row.data('alternative', _alternative);

            if (href === selfHref && $viewLink.html() === $self.html()) {
                if ($row.is('.active-indicator')) {
                    $row.addClass('active').attr('title', 'Current link');
                }
            }

            if (_alternative.groupTarget && counter >= GROUP_TARGET_MIN) {

                if (!groups[_alternative.groupTarget]) {
                    let $groupRow = $(simpleParse(groupTpl, {
                        title: _alternative.groupTarget
                    }));
                    $groupRow.attr("data-state", 0)
                    $groupRow.click((e) => {
                        e.preventDefault();
                        let $items = $("[data-group='" + _alternative.groupTarget + "']", $table);
                        $items.toggle();

                        $groupRow.attr("data-state", $items.css('display') === 'none' ? 0 : 1);
                        return false;
                    })
                    $table.append($groupRow);
                    // append fake row to expand/collapse grouped rows
                    groups[_alternative.groupTarget] = true;
                }

                $row.css("display", "none")
            }

            $table.append($row);
            renderedViews.push(viewKey);
        });

        if ('edit' == (R2L.options.mode || R2L.viewOptions.mode)) {
            hasRows = true;
            var $row = $(simpleParse(R2L.options.rule, {
                title: 'No link',
                href: ''
            }));

            $row.attr('title', 'Remove link');
            $table.append($row.removeClass('active-indicator').attr('data-action', 'remove'));
        }

        if (!hasRows) {
            return;
        }

        $tooltip.on('click', '[data-action]', function (ev2) {
            var $this = $(this),
                $row = $this.closest('.row'),
                alternative = $row.length ? $row.data('alternative') : {},
                $view = alternative ? $(alternative.view) : $(''),
                $viewLink = $view.is(R2L.settings.classSimple) ? $view : $view.find(R2L.settings.classSimple),
                action = $this.attr('data-action');

            var href = $viewLink.attr('href') || $viewLink.find("a").attr('href');
            var selfHref = $self.attr('href') || $self.find("a").attr('href');

            switch (action) {
                case 'preview':
                    if ($viewLink.length) {
                        window.open(href);
                    }
                    break;
                case 'use':
                    if ($view.length) {
                        $self.setAlternative(alternative);
                        $tooltip.remove();
                        let id = $view.attr('id');
                        setTimeout(() => {
                            showTooltipHandler(null, $('#' + id));
                        }, 1);
                    }
                    break;
                case 'default-preview':
                    window.open(selfHref);
                    break;
                case 'remove':
                    $self.removeReference();
                    break;
                case 'close':
                    $tooltip.hide();
                    break;
            }
            hideTooltipHandler();

            return stopEvent(ev2);
        });

        let uuid = 'r2l-tooltip-' + getUuid();
        $target.attr('title', '').attr('aria-describedby', uuid);
        $tooltip.attr('id', uuid);

        repositionTooltipHandler($self, $tooltip);

        $tooltip.css('visibility', 'hidden');

        // make sure that only one element with this selector exist
        if ($(R2L.settings.tooltipContainerSelector).length === 1) {
            $(R2L.settings.tooltipContainerSelector).append($tooltip);
        } else {
            // Otherwhise insert in body
            $('body').append($tooltip);
        }

        $self.data('tooltip', $tooltip);
        $tooltip.data('tooltip', $tooltip);
        $tooltip.data('ref2link', $self);

        $tooltip.attr('data-state', 'active');

        // cleanup attributes
        let nodeAttributes = cleanAttributes(currentViewAttributes);

        nodeAttributes.tooltipUuid = uuid;

        // we need to pass the R2LOrderedNode in the event
        let nodes = R2L.getNodes({ 0: ref2link });
        nodes = nodes.filter(node => {
            let filteredMatches = node.matches.filter(match => match.context === ref2link.context && match.match === ref2link.match);
            return filteredMatches.length > 0
        });

        let orderedNodes = R2L.getOrderedNodes(nodes);
        if (orderedNodes.length > 0) {
            nodeAttributes.node = orderedNodes[0];
        }

        // overwrite linked data in case target has changed
        if (globalBinding && globalBinding.data && nodeAttributes.node && nodeAttributes.node.data) {
            if (nodeAttributes.node.data[0]) {
                nodeAttributes.node.data[0].metadata = globalBinding.data;
            }
            if (!nodeAttributes.node.data[0].celex && globalBinding.data.celexId) {
                nodeAttributes.node.data[0].celex = String(globalBinding.data.celexId.value).replace("celex:", "");
            }
            if (globalBinding.data.id && globalBinding.data.id.value.indexOf("celex:") === 0) {
                nodeAttributes.node.data[0].celex = globalBinding.data.id.value.replace("celex:", "");
            }
        }

        $(document).trigger('r2l.tooltip.create', nodeAttributes);
    });
};

/**
 * Get the table view (or the match text if no table view present)
 * @param {Object} ref2link
 * 
 * @return {String} 
 */
export function getTableViewReference(ref2link) {
    let label = ref2link.reference;
    Object.keys(ref2link.views).forEach((_view) => {
        var view = ref2link.views[_view];
        if (!view) {
            return;
        }

        if (String(_view) === "table") {
            label = view;
        }
    });
    return label;
}


export function addStyle(styleText, styleName, $) {
    var styleFileName = styleName
        .split('/').pop() /** filename */
        .split('?').shift() /** strip query string */
        .replace('ref2link-', ''), /** ref2link version of some common packages */
        unMinifiedStyleFileName = styleFileName.replace('.min', '')
        ;
    /** attempt to see if the style is already loaded and if not so add the style to the page */
    if (!$('link[href*="' + styleFileName + '"]').length && !$('link[href*="' + unMinifiedStyleFileName + '"]').length && styleText) {
        $('head').append($('<style type="text/css"></style>').html(styleText));
    }
};

export function getTriggers(R2L) {
    return {
        'mouseenter': {
            show: [
                'mouseenter',
                R2L.settings.class + ', ' + TOOLTIP_CLASS,
                showTooltipHandler
            ],
            hide: [
                'mouseleave',
                R2L.settings.class + ', ' + TOOLTIP_CLASS,
                hideTooltipHandler
            ]
        },
        'focus': {
            show: [
                'focus',
                R2L.settings.class + ', ' + TOOLTIP_CLASS,
                showTooltipHandler
            ],
            hide: [
                'focusout',
                R2L.settings.class + ', ' + TOOLTIP_CLASS,
                hideTooltipHandler
            ]
        },
        'notooltip': {
            show: null,
            hide: null
        }
    }
};

/**
 * Bind the tooltip events and API methods. Only to be used for browser integration.
 *  
 * @param {Object} R2L 
 */
export function bindTooltips(R2L) {

    R2L.bindTooltips = function () {
        if (this.options.tooltipTrigger === 'notooltip' || this.tooltipInitialized) {
            return this;
        }

        this.tooltipInitialized = true;
        this.resetFilters();

        var cssMap = {};
        try {
            cssMap = JSON.parse(R2L.getConstant("R2L_CSS_MAP"));
        }
        catch (e) {
            console.error(e);
        }

        for (let cssIndex in cssMap) {
            addStyle(Base64.decode(cssMap[cssIndex]), cssIndex, $); // css injection
        }

        let trigger = this.triggers[this.options.tooltipTrigger || this.viewOptions.tooltipTrigger];
        let $selector = $(trigger.show[4] || trigger.selector || document);

        $selector.on.apply($selector, trigger.show);
        $selector.on.apply($selector, trigger.hide);

        // also bind accessibility triggers (focus)
        trigger = this.triggers['focus'];
        if (trigger) {
            $selector = $(trigger.show[4] || trigger.selector || document);

            $selector.on.apply($selector, trigger.show);
            $selector.on.apply($selector, trigger.hide);
        }

        $(window).off('resize', positionHandler).on('resize', positionHandler);
    }

    R2L.unbindTooltips = function () {
        let trigger = this.triggers[this.options.tooltipTrigger || this.viewOptions.tooltipTrigger];
        let $selector = $(trigger.show[4] || trigger.selector || document);

        $selector.off.apply($selector, trigger.show);
        $selector.off.apply($selector, trigger.hide);

        $(window).off('resize', positionHandler);
        this.tooltipInitialized = false;
    }

    R2L.bindTooltips();
};
