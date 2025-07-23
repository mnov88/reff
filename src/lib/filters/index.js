import { $ } from '../jquery.js';
import { clearRuntimeRules } from '../rules/index.js';
import { intersect } from '../utils/functions.js';

let _filterInitialized = false;

export function bindFilters(R2L) {
    R2L.getInitialFilters = function () {
        let filters = {};
        /** Only in browser env we try to read querystring params of the library */
        if (typeof window === "undefined") {
            return filters;
        }

        try {
            let scriptSrc = $('script[src*="ref2link"]').first().attr('src');
            let sqv = decodeURIComponent(scriptSrc.indexOf('?') >= 0 ? scriptSrc.split('?').pop() : '');
            let lqv = decodeURIComponent(document.location.href.indexOf('?') >= 0 ? document.location.href.split('?').pop() : '');
            let qv = [sqv, lqv].join('&');

            if (qv) {
                var parts = qv.split('&');
                for (var i = 0; i < parts.length; i++) {
                    var p = parts[i].split('=');
                    if (p && p.length > 1 && p[1] && p[1] !== '_default') {
                        if (p[0] == 're' || p[0] == 'ruleenvironment') {
                            filters['environments'] = p[1].split(',');
                        }
                        if (p[0] == 'rt' || p[0] == 'ruletarget') {
                            filters['targets'] = p[1].split(',');
                        }
                        if (p[0] == 'rr' || p[0] == 'ruletype') {
                            filters['types'] = p[1].split(',');
                        }
                        if (p[0] == 'sort') {
                            filters['sort'] = p[1];
                        }
                        if (p[0] == 'views' && !isNaN(p[1])) {
                            filters['views'] = parseInt(p[1]);
                        }
                    }
                }
            }
        } catch (e) { }

        return filters;
    };

    R2L.resetFilters = function () {
        if (_filterInitialized) {
            return;
        }

        _filterInitialized = true;

        let filters = R2L.getInitialFilters();
        R2L.filters = R2L.defaultFilters;

        Object.keys(filters, function (filterName) {
            let filterValue = filters[filterName];
            R2L.setFilter(filterName, filterValue);
        })
    };

    R2L.setFilter = function (searchedField, searchValue, preserveRuntime) {
        if (Array.isArray(searchValue)) {
            _filterInitialized = true;
            if (searchedField == 'environments') {// always add public rules
                clearRuntimeRules();

                var filteredEnvironments = [], globalEnvironments = Object.keys(R2L.getGlobalEnvironments());
                searchValue.forEach(function (_searchVal) {
                    if (globalEnvironments.indexOf('' + _searchVal) >= 0) {
                        filteredEnvironments.push('' + _searchVal);
                    }
                });
                if (filteredEnvironments.indexOf('*') < 0) {
                    filteredEnvironments.push('*');
                }

                searchValue = filteredEnvironments;
                R2L.filters['environments'] = searchValue;
            }

            R2L.filters[searchedField] = searchValue;
            /** see what targets match now that the env changed; reset targets with views that are in environment */
            var filteredRules = R2L.getAllRules(),
                availableTargets = []
                ;
            filteredRules.forEach(function (_filteredRule) {
                _filteredRule.views.forEach(function (_view) {
                    var targetName = _view.target;
                    if (availableTargets.indexOf(targetName) < 0) {
                        availableTargets.push(targetName);
                    }
                })
            });

            if (R2L.filters['targets'] && R2L.filters['targets'].length) {
                R2L.filters['targets'] = intersect(R2L.filters['targets'], availableTargets);
            }
            else {
                R2L.filters['targets'] = availableTargets;
            }

            if (R2L.filters['targets'].indexOf('table') === -1) {
                R2L.filters['targets'].push('table');
            }

            if ((R2L.filters.hasOwnProperty('targets') && R2L.filters.targets.length === 0) || (R2L.filters.hasOwnProperty('types') && R2L.filters.types.length === 0)) {
                R2L.filters['targets'] = ['NONEOFTHISMATCHES'];
            }

            if (R2L.filters.hasOwnProperty('excludetargets')) {
                R2L.filters['excludetargets'].map(excludeTarget => {
                    R2L.filters['targets'] = R2L.filters['targets'].filter(t => t.indexOf(excludeTarget) === -1)
                });
            }

            clearRuntimeRules();
            if (!preserveRuntime) {
                R2L.clearCache();
            }
        }
    };

    /** application parameters placeholders ; the generated file might have other values set in parameters.xml **/
    let _viewOptions = {};
    try {
        _viewOptions = JSON.parse(R2L.getConstant("R2L_VIEW_OPTIONS"));
    }
    catch (e) {
        console.error(e);
    }

    R2L.linkClassName = _viewOptions['linkClassName'];
    R2L.viewUsesTarget = _viewOptions['viewUsesTarget'];
    R2L.viewTitlePrefix = _viewOptions['viewTitlePrefix'];
    R2L.viewTitleSuffix = _viewOptions['viewTitleSuffix'];

    // when document is ready reset the filters
    $(R2L.resetFilters);
}