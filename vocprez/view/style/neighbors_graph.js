onload = () => {
    const ignoredLinks = [
        'http://www.opengis.net/def/metamodel/ogc-na/status',
    ];
    const incomingColor = 'red', outgoingColor = 'blue';
    const baseUrl = d3.select('body').attr('data-base-url');
    const height = 600;
    const padding = 10, margin = 10;

    const escapeHtml = (s) => s ? s.replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;')
            .replaceAll('"', '&quot;')
            .replaceAll("'", '&#039;') : '';

    function boundedBox() {
        let nodes, sizes, bounds;
        let size = () => [0, 0];

        const force = () => {
            for (const [i, node] of nodes.entries()) {
                const nodeSize = sizes[i];
                const xi = node.x + node.vx,
                    x0 = bounds[0][0] - xi,
                    x1 = bounds[1][0] - (xi + nodeSize[0]),
                    yi = node.y + node.vy,
                    y0 = bounds[0][1] - yi,
                    y1 = bounds[1][1] - (yi + nodeSize[1]);
                if (x0 > 0 || x1 < 0) {
                    node.x += node.vx;
                    node.vx = -node.vx;
                    if (node.vx < x0) {
                        node.x += x0 - node.vx;
                    }
                    if (node.vx > x1) {
                        node.x += x1 - node.vx;
                    }
                }
                if (y0 > 0 || y1 < 0) {
                    node.y += node.vy;
                    node.vy = -node.vy;
                    if (node.vy < y0) {
                        node.vy += y0 - node.vy;
                    }
                    if (node.vy > y1) {
                        node.vy += y1 - node.vy;
                    }
                }
            }
        };

        force.initialize = n => {
            sizes = (nodes = n).map(size)
        };

        force.bounds = (...b) => typeof b === 'undefined' ? bounds : (bounds = b, force);

        force.size = (s, ...x) => {
            if (typeof s === 'undefined') {
                return size;
            }
            size = typeof s === 'function' ? s : () => s;
            return force;
        };

        return force;
    }

    const profiles = [{
        label: "",
        filter: d => d.filter(item => Math.random() > 0.5),
    }];

    const toId = s => {
        return `_${s.replace(/^[a-zA-Z0-9-_]/, '_')}`;
    };

    const radian = (ux, uy, vx, vy) => {
        const dot = ux * vx + uy * vy;
        const mod = Math.sqrt( ( ux * ux + uy * uy ) * ( vx * vx + vy * vy ) );
        const rad = Math.acos( dot / mod );
        return ux * vy - uy * vx < 0.0 ? -rad : rad;
    }

    const svgArcToCenterParam = (x1, y1, rx, ry, phi, fA, fS, x2, y2) => {
        var cx, cy, startAngle, deltaAngle, endAngle;
        var PIx2 = Math.PI * 2.0;

        if (rx < 0) {
            rx = -rx;
        }
        if (ry < 0) {
            ry = -ry;
        }
        if (rx == 0.0 || ry == 0.0) { // invalid arguments
            return { cx: x1, cy: y1 };
        }

        var s_phi = Math.sin(phi);
        var c_phi = Math.cos(phi);
        var hd_x = (x1 - x2) / 2.0;
        var hd_y = (y1 - y2) / 2.0;
        var hs_x = (x1 + x2) / 2.0;
        var hs_y = (y1 + y2) / 2.0;

        var x1_ = c_phi * hd_x + s_phi * hd_y;
        var y1_ = c_phi * hd_y - s_phi * hd_x;

        var lambda = (x1_ * x1_) / (rx * rx) + (y1_ * y1_) / (ry * ry);
        if (lambda > 1) {
            rx = rx * Math.sqrt(lambda);
            ry = ry * Math.sqrt(lambda);
        }

        var rxry = rx * ry;
        var rxy1_ = rx * y1_;
        var ryx1_ = ry * x1_;
        var sum_of_sq = rxy1_ * rxy1_ + ryx1_ * ryx1_; // sum of square
        var coe = Math.sqrt(Math.abs((rxry * rxry - sum_of_sq) / sum_of_sq));
        if (fA == fS) { coe = -coe; }

        var cx_ = coe * rxy1_ / ry;
        var cy_ = -coe * ryx1_ / rx;

        cx = c_phi * cx_ - s_phi * cy_ + hs_x;
        cy = s_phi * cx_ + c_phi * cy_ + hs_y;

        var xcr1 = (x1_ - cx_) / rx;
        var xcr2 = (x1_ + cx_) / rx;
        var ycr1 = (y1_ - cy_) / ry;
        var ycr2 = (y1_ + cy_) / ry;

        startAngle = radian(1.0, 0.0, xcr1, ycr1);

        deltaAngle = radian(xcr1, ycr1, -xcr2, -ycr2);
        while (deltaAngle > PIx2) { deltaAngle -= PIx2; }
        while (deltaAngle < 0.0) { deltaAngle += PIx2; }
        if (fS == false || fS == 0) { deltaAngle -= PIx2; }
        endAngle = startAngle + deltaAngle;
        while (endAngle > PIx2) { endAngle -= PIx2; }
        while (endAngle < 0.0) { endAngle += PIx2; }

        return {
            cx: cx,
            cy: cy,
            startAngle: startAngle,
            deltaAngle: deltaAngle,
            endAngle: endAngle,
            clockwise: (fS == true || fS == 1)
        }
    }

    const arcIntercept = (s, t, cx, cy, r, margin) => {
        let minDist = Infinity, x = null, y;
        const scenter = {x: (s.x + s.X) / 2, y: (s.y + s.Y) / 2}
        for (let yTest of [t.y, t.Y]) {
          let sqrt = Math.sqrt(r * r - (yTest - cy) * (yTest - cy));
          if (sqrt) {
            for (let xInt of [cx + sqrt, cx - sqrt]) {
              if (t.x <= xInt && t.X >= xInt) {
                let dist = Math.hypot(xInt - scenter.x, yTest - scenter.y);
                if (dist <= minDist) {
                  minDist = dist;
                  x = xInt;
                  y = yTest;
                }
              }
            }
          }
        }
        for (let xTest of [t.x, t.X]) {
          let sqrt = Math.sqrt(r * r - (xTest - cx) * (xTest - cx));
          if (sqrt) {
            for (let yInt of [cy + sqrt, cy - sqrt]) {
              if (t.y <= yInt && t.Y >= yInt) {
                let dist = Math.hypot(xTest - scenter.x, yInt - scenter.y);
                if (dist <= minDist) {
                  minDist = dist;
                  x = xTest;
                  y = yInt;
                }
              }
            }
          }
        }

        if (x !== null) {
            return {
              x: x + (x <= t.x ? -margin : margin),
              y: y + (y <= t.y ? -margin : margin),
            };
        }
        return null;
    };

    const linkArc = (d) => {
        const margin = 4;

        const [s, t] = [d.source, d.target].map(r => r.innerBounds);
        let [start, end] = [s, t].map(r => ({
          x: (r.x + r.X) / 2,
          y: (r.y + r.Y) / 2,
        }));
        const r = Math.hypot(end.x - start.x, end.y - start.y);

        const {cx, cy} = svgArcToCenterParam(start.x, start.y, r, r, 0, 0, 0, end.x, end.y);

        end = arcIntercept(s, t, cx, cy, r, margin) || end;
        start = arcIntercept(t, s, cx, cy, r, 0) || start;

        d.arc = { start, end, r, cx, cy };

        return `
            M${start.x},${start.y}
            A${r},${r} 0 0,0 ${end.x},${end.y}
        `;
    }

    d3.selectAll('.neighbors-graph').each(async function() {
        const wrapper = d3.select(this);
        const width = wrapper.node().offsetWidth;
        var loadedData = null;

        const [sourceRes, sourceLabel, sourceType] = [
            wrapper.attr('data-res'),
            wrapper.attr('data-label'),
            wrapper.attr('type'),
        ];

        const color = d3.scaleOrdinal(d3.schemePastel2);

        const simulation = d3.forceSimulation()
            .alpha(0.5)
            .alphaTarget(0.1)
            .stop();

        const svg = wrapper.select('.svg-wrapper').append("svg")
            .attr("width", width)
            .attr("height", height);

        const legend = wrapper.append("div")
            .attr('class', 'legend');

        const tooltip = wrapper.select('.svg-wrapper').append("div")
            .attr('class', 'neighbor-tooltip');

        svg.append("defs").append("marker")
              .attr("id", d => `arrow-outgoing`)
              .attr("viewBox", "0 -5 10 10")
              .attr("refX", 5)
              .attr("refY", -0.5)
              .attr("markerWidth", 6)
              .attr("markerHeight", 6)
              .attr("orient", "auto")
            .append("path")
              .attr("fill", outgoingColor)
              .attr("d", "M0,-5L10,0L0,5");

        svg.append("defs").append("marker")
              .attr("id", d => `arrow-incoming`)
              .attr("viewBox", "0 -5 10 10")
              .attr("refX", 5)
              .attr("refY", -0.5)
              .attr("markerWidth", 6)
              .attr("markerHeight", 6)
              .attr("orient", "auto")
            .append("path")
              .attr("fill", incomingColor)
              .attr("d", "M0,-5L10,0L0,5");

        const hcModal = wrapper.select('.high-cardinality-modal');
        hcModal.select('.icon-single rect').attr('fill', color(sourceType));
        hcModal.select('.close-modal').on('click', () => hcModal.classed('visible', false));

        let nodes, links;

        params = new URLSearchParams({ res: sourceRes });

        let node;

        let dragParams = null;
        const drag = d3.drag()
            .on('start', (ev, d) => {
                if (!ev.active) {
                    simulation.alpha(0.5).alphaTarget(0.1).restart();
                }
                node.filter(n => n.res === d.res).raise();
                if (d.res === sourceRes) {
                    dragParams = null;
                } else {
                    dragParams = {
                        pos: [ev.x, ev.y],
                        offset: [ev.x - d.x, ev.y - d.y],
                    };
                    d.fx = d.x;
                    d.fy = d.y;
                }
            })
            .on('drag', (ev, d) => {
                if (!dragParams) {
                    return;
                }
                d.fx = Math.max(Math.min((dragParams.pos[0] = ev.x) - dragParams.offset[0], width - d.width), 0);
                d.fy = Math.max(Math.min((dragParams.pos[1] = ev.y) - dragParams.offset[1], height - d.height), 0);
            })
            .on('end', (ev, d) => {
                if (!ev.active) {
                    simulation.alphaTarget(0.0001);
                }
                dragParams = null;
            });

        let tooltipNode = null;
        const updateTooltip = (html, node) => {
            if (html === false) {
                tooltipNode = null;
            } else if (node) {
                tooltipNode = node;
            }
            if (tooltipNode) {
                if (html && html != tooltip.text()) {
                    tooltip.html(html);
                }
                const bbox = tooltipNode.getBBox(),
                    xCenter2 = bbox.x + bbox.x + bbox.width,
                    yCenter2 = bbox.y + bbox.y + bbox.height,
                    margin = 5,
                    ttheight = tooltip.node().offsetHeight + margin,
                    ttwidth = tooltip.node().offsetWidth + margin;

                let top = null,
                    left = null;

                let yAligned = false;
                if (yCenter2 >= height) { // closer to bottom
                    if (bbox.y + bbox.height + ttheight < height) { // fits below node
                        yAligned = true;
                        top = bbox.y + bbox.height;
                    } else {
                        top = Math.min(bbox.y, height - ttheight);
                    }
                } else if (ttheight < bbox.y) { // fits above node
                    yAligned = true;
                    top = bbox.y - ttheight;
                } else {
                    top = Math.max(0, bbox.y + bbox.height - ttheight + margin);
                }

                if (xCenter2 >= width) { // closer to right
                    if (yAligned) { // right-aligned
                        left = bbox.x + bbox.width - ttwidth;
                    } else if (bbox.x + bbox.width + ttwidth < width) {
                        left = bbox.x + bbox.width;
                    } else {
                        left = bbox.x - ttwidth;
                    }
                } else if (yAligned) {
                    left = bbox.x;
                } else if (ttwidth < bbox.x) {
                    left = bbox.x - ttwidth;
                } else {
                    left = bbox.x + bbox.width;
                }

                tooltip.classed('visible', true)
                    .style('top', top === null ? null : `${top}px`)
                    .style('left', left === null ? null : `${left}px`);
            } else {
                tooltip.classed('visible', false)
            }
        };

        const updateHCModal = (prop, propLabel, outgoing, page = 1) => {
            hcModal.classed('loading', true);
            const p = new URLSearchParams({
                res: sourceRes,
                prop,
                dir: outgoing ? 'outgoing' : 'incoming',
                page,
            });

            const arrows = outgoing ? ['&#x23af;', '&#x2192;'] : ['&#x2190;', '&#x23af;'];
            hcModal.select('.property .marker-start').html(arrows[0]);
            hcModal.select('.property .marker-end').html(arrows[1]);
            const propLink = hcModal.select('.property a')
                .attr('href', prop)
                .attr('target', '_blank');
            propLink.select('.property-name')
                .text(propLabel);
            propLink.select('.property-uri')
                .text(prop);

            d3.json(`${baseUrl}/neighbors/items?${p.toString()}`)
                .then(data => {
                    hcModal.select('.items').selectAll('.item')
                        .data(data.items, d => d.item.value)
                        .join(
                            enter => {
                                const li = enter.append('li')
                                    .attr('class', 'item');

                                const wrapper = li.append('div')
                                    .attr('class', 'item-wrapper');

                                wrapper.append('a')
                                    .attr('class', 'item-title')
                                    .attr('href', d => `${baseUrl}/object?uri=${encodeURIComponent(d.item.value)}&_profile=skos`)
                                    .text(d => d.label.value)

                                wrapper.append('div')
                                    .attr('class', 'item-class')
                                    .text('Class:')
                                    .append('a')
                                    .attr('class', 'item-class-value')
                                    .attr('href', d => d.type.value)
                                    .attr('target', '_blank')
                                    .text(d => d.typeLabel?.value ?? d.type.value);

                                return li;
                            }
                        );

                    const p = data.pagination;
                    let pages = [{ label: '1', page: 1}];
                    if (p.pages > 7 && p.page > 4) {
                        pages.push(null);
                    }
                    if (p.pages > 2) {
                        const f = Math.max(Math.min(p.page - 2, Math.min(p.page + 2, p.pages - 1) - 5), 2),
                            t = Math.min(Math.max(p.page + 2, Math.max(p.page - 2, 2) + 5), p.pages - 1);
                        for (let i = f; i <= t; i++) {
                            pages.push({ label: i, page: i });
                        }
                    }
                    if (p.pages > 7 && p.pages - p.page > 5) {
                        pages.push(null);
                    }
                    if (p.pages > 1) {
                        pages.push({ label: p.pages, page: p.pages });
                    }
                    const pwrapper = hcModal.select('.pagination').html(null);
                    for (const link of pages) {
                        if (link) {
                            pwrapper.append('a')
                                .datum(link)
                                .attr('class', 'page-item page-link')
                                .attr('href', '#')
                                .text(link.label);
                        } else {
                            pwrapper.append('span')
                                .attr('class', 'page-item page-separator')
                                .text('...');
                        }
                    }
                    pwrapper.selectAll('a')
                        .on('click', function(ev, d) {
                            ev.preventDefault();
                            if (d && d.page !== p.page) {
                                updateHCModal(prop, propLabel, outgoing, d.page);
                            }
                        })
                })
                .finally(() => {
                    hcModal.classed('loading', false);
                });

            hcModal.classed('visible', true);
        };

        const filterFunctions = {
            'regex': (s, v) => !!s.match(new RegExp(v)),
            'prefix': (s, v) => s.startsWith(v),
        };

        const applyFilters = (nodes, links, filters) => {

            let fNodes = nodes, fLinks = links;

            if (filters) {
                if (!Array.isArray(filters)) {
                    filters = [filters];
                }
                for (const flt of filters) {
                    for (const [funcName, ffunc] of Object.entries(filterFunctions)) {
                        const fval = flt[funcName];
                        if (!fval) {
                            continue;
                        }
                        if (flt['@type'] === 'ResourceURIFilter') {
                            fNodes = fNodes.filter(n => n.res == sourceRes || ffunc(n.res, fval));
                            fLinks = fLinks.filter(l => ffunc(fNodes[l.source].res, fval)
                                || ffunc(fNodes[l.target].res, fval));
                        } else if (flt['@type'] === 'PropertyFilter') {
                            fLinks = fLinks.filter(l => ffunc(l.prop, fval));
                            let filteredNodes = fLinks.map(l => l.source.res == sourceRes ? l.target.res : l.source.res);
                            fNodes = fNodes.filter(n => n.highCardinality
                                ? ffunc(n.prop, fval)
                                : n.res == sourceRes || filteredNodes.includes(n.res));
                        } else {
                            console.log(`Unknown filter type ${flt['@type']}, ignoring`)
                        }
                    }
                }
            }

            return { fNodes, fLinks };
        }

        const update = function(fNodes = nodes, fLinks = links) {

            const legendClasses = [...new Map(nodes.filter(d => d.type).map(d => [d.type, d])).values()];
            legend.selectAll('.legend-entry')
                .data(legendClasses)
                .join(
                    enter => {
                        const e = enter.append('div')
                            .attr('class', 'legend-entry')
                            .attr('title', d => d.type);
                        e.append('span')
                            .attr('class', 'legend-entry-marker')
                            .style('background-color', d => color(d.type));
                        e.append('span')
                            .attr('class', 'legend-entry-label')
                            .text(d => d.typeLabel);
                        return e;
                    }
                );

            const addLinkTooltipEvents = x =>
                x.on('mouseover', (ev, d) => {
                    if (dragParams) {
                        return;
                    }
                    [link, linkLabel].forEach(x =>
                        x.style('opacity', function(l) {
                            return l.id === d.id ? (d3.select(this).raise(), 1) : 0.1;
                        }));
                    node.style('opacity', function(n) {
                        return [d.source, d.target].includes(n) ? (d3.select(this).raise(), 1) : 0.4;
                    });
                    let html = `<div class="tooltip-title">${escapeHtml(d.label)}</div>
                                  <div class="tooltip-uri">${escapeHtml(d.prop)}</div>`;
                    if (d.desc) {
                        html += `<p className="tooltip-desc">${escapeHtml(d.desc)}</p>`;
                    }
                    updateTooltip(html, ev.target);
                })
                .on('mouseout', (ev, d) => {
                    if (dragParams) {
                        return;
                    }
                    [node, link, linkLabel].forEach(x => x.style('opacity', 1));
                    node.raise();
                    updateTooltip(false);
                });

            const linkCount = {};
            fLinks.forEach(l => {
                const n = l.source.res == sourceRes ? l.target : l.source;
                linkCount[n.id] = (linkCount[n.id] || 0) + 1;
            });

            const ticked = function() {
                node.each(function(d) {
                        d.innerBounds = {
                            x: d.x + margin / 2,
                            y: d.y + margin / 2,
                            width: d.width - margin,
                            height: d.height - margin,
                        };
                        d.innerBounds.X = d.innerBounds.x + d.innerBounds.width;
                        d.innerBounds.Y = d.innerBounds.y + d.innerBounds.height;
                    });

                node.selectAll('rect').attr("x", d => d.innerBounds.x)
                    .attr("y", d => d.innerBounds.y)
                    .attr("width", d => d.innerBounds.width)
                    .attr("height", d => d.innerBounds.height);

                link.attr("d", linkArc);

                linkLabelPath.attr("d", d => {
                    let { start, end, r, cx, cy } = d.arc;
                    let sweep = 0, offset = 5;
                    if (start.x > end.x) {
                        [start, end] = [end, start];
                        sweep = 1;
                        offset = 10;
                    }
                    const aStart = Math.atan2(start.y - cy, start.x - cx),
                        aEnd = Math.atan2(end.y - cy, end.x - cx);
                    return `
                        M${start.x - Math.cos(aStart) * offset},${start.y - Math.sin(aStart) * offset}
                        A${r},${r} 0 0,${sweep} ${end.x - Math.cos(aEnd) * offset},${end.y - Math.sin(aEnd) * offset}
                    `;
                });

                node.selectAll('.label').attr("x", function (d) { return d.innerBounds.x + padding })
                     .attr("y", function (d) {
                         var h = this.getBBox().height;
                         return d.innerBounds.y + d.innerBounds.height / 2 - h / 2 + padding;
                     });

                updateTooltip();
            };

            const link = svg.selectAll(".link")
                .data(fLinks, d => d.id)
                .join(
                    enter => enter.append("path")
                        .call(addLinkTooltipEvents),
                    u => u,
                    exit => exit.remove())
                        .attr("class", "link")
                        .attr("fill", "none")
                        .attr("stroke", d => d.outgoing ? outgoingColor : incomingColor)
                        .attr("stroke-width", "1.5px")
                        .attr("stroke-opacity", "1")
                        .attr("marker-end", d => `url(${new URL(`#arrow-${d.outgoing ? 'outgoing' : 'incoming'}`, location)})`);

            const linkLabelPath = svg.selectAll('.link-label-path')
                .data(fLinks, d => d.id)
                .join(
                    enter => enter.append("path"),
                    u => u,
                    exit => exit.remove()
                )
                    .attr('class', 'link-label-path')
                    .attr('fill', 'none')
                    .attr('stroke-width', '1px')
                    .attr('id', d => `link-label-path-${toId(d.id)}`);

            const linkLabel = svg.selectAll('.link-label')
                .data(fLinks, d => d.id)
                .join(
                    enter => {
                        const t = enter.append("text");
                        t.append('textPath')
                            .attr('startOffset', '50%')
                            .attr('xlink:href', d => `#link-label-path-${toId(d.id)}`)
                            .text(d => d.label)
                            .call(addLinkTooltipEvents);
                        return t;
                    },
                    u => u,
                    exit => exit.remove()
                )
                    .attr('class', 'link-label')
                    .attr('text-anchor', 'middle')
                    .attr('font-size', '10px');

            node = svg.selectAll('.node')
                .data(fNodes, d => d.res)
                .join(
                    enter => {
                        const g = enter.append("g")
                            .attr('class', 'node')
                            .attr('data-uri', d => d.res);
                        g.append('rect')
                            .attr('rx', 5)
                            .attr('ry', 5)
                            .attr('stroke', 'white')
                            .attr('stroke-width', '1.5px')
                            .attr('cursor', d => d.res === sourceRes ? null : 'pointer')
                            .style("fill", d => color(d.highCardinality ? 'highCardinality' : d.type))
                            .on('click', (ev, d) => {
                                if (d.res) {
                                    window.location = `${baseUrl}/object?uri=${encodeURIComponent(d.res)}&_profile=skos`;
                                } else if (d.highCardinality) {
                                    updateHCModal(d.prop, d.propLabel, d.outgoing);
                                }
                            })
                            .on('mouseover', (ev, d) => {
                                if (d.res === sourceRes || dragParams) {
                                    return;
                                }
                                [link, linkLabel].forEach(x =>
                                    x.style('opacity', function(l) {
                                        return ([l.source, l.target].includes(d))
                                            ? (d3.select(this).raise(), 1) : 0.1;
                                    }));
                                node.style('opacity', function(n) {
                                    return (n.res === sourceRes
                                        || (d.highCardinality
                                            ? n.highCardinality && n.prop == d.prop
                                            : [d.res, sourceRes].includes(n.res)))
                                        ? (d3.select(this).raise(), 1) : 0.4;
                                });
                                if (d.highCardinality) {
                                    updateTooltip("Click to see details", ev.target);
                                } else {
                                    updateTooltip(
                                        `<div class="tooltip-title">${escapeHtml(d.label)}</div>
                                            <div class="tooltip-uri">${escapeHtml(d.res)}</div>
                                            <div class="tooltip-class">Class: ${escapeHtml(d.typeLabel)}
                                                <div class="tooltip-class-uri">${escapeHtml(d.type)}</div>
                                            </div>`, ev.target);
                                }
                            })
                            .on('mouseout', (ev, d) => {
                                if (dragParams) {
                                    return;
                                }
                                [node, link, linkLabel].forEach(x => x.style('opacity', 1));
                                node.raise();
                                updateTooltip(false);
                            })
                            .call(drag)
                            .append("title")
                            .filter(d => d.label)
                            .text(d => d.label);
                        g.append('text')
                            .attr("class", "label")
                            .attr("cursor", d => d.highCardinality ? "help" : "pointer")
                            .attr("font-size", "12px")
                            .attr('style', 'pointer-events: none')
                            .attr('data-uri', d => d.res)
                            .text(function (d) {
                                if (d.highCardinality) {
                                    return `${d.count} resources`;
                                }
                                return d.res != sourceRes && d.label.length > 30 ? d.label.substring(0, 29) + "…" : d.label;
                            })
                            .each(function(d) {
                                var bb = this.getBBox();
                                d.width = bb.width + 2 * padding + margin;
                                d.height = bb.height + 2 * padding + margin;
                                if (d.res === sourceRes) {
                                    d.fx = (width - d.width) / 2;
                                    d.fy = (height - d.height) / 2;
                                }
                            });
                        return g;
                    },
                    u => u,
                    exit => exit.remove()
                );

            link.lower();
            linkLabel.lower();

            simulation.nodes(fNodes)
                .force('charge', d3.forceManyBody().strength(-300))
                .force('link', d3.forceLink(links)
                    .distance(d => 150 + (20 * Math.random()) + 50 * (linkCount[d.source.res == sourceRes ? d.target.id : d.source.id] || 1))
                    .strength(0.01))
                .force('box', boundedBox().bounds([0, 0], [width, height]).size(d => [d.width, d.height]))
                .force('radial', d3.forceRadial(d => Math.min(width, height) / (5 - 2 * ((linkCount[d.id] || 1) - 1)),
                    width / 2, height / 2));

            ticked();
            for (let i = 0, n = Math.ceil(Math.log(simulation.alphaMin()) / Math.log(1 - simulation.alphaDecay())); i < n; i++) {
                simulation.tick();
            }

            simulation.on("tick", ticked);
            ticked();
        };

        d3.json(`${baseUrl}/neighbors?${params.toString()}`)
            .then(data => {
                const sourceNode = { res: sourceRes, label: sourceLabel, type: sourceType };
                nodes = [sourceNode];
                links = [];
                const seen = { sourceRes: 0 };

                const addItem = (item) => {
                    let node = seen[item.resource.value];
                    if (!node) {
                        node = {
                            res: item.resource.value,
                            label: item.label.value,
                            type: item.type.value,
                            typeLabel: item.typeLabel?.value ?? item.type.value.replace(/^.*[#/]/, ''),
                            id: item.resource.value,
                        };
                        node.index = nodes.push(node) - 1;
                        seen[item.resource.value] = node;
                    }
                    return node;
                };

                const addLink = (item, highCardinality) => {
                    if (ignoredLinks.includes(item.prop.value)
                            || item?.resource?.value === sourceRes) {
                        return;
                    }
                    const outgoing = item.outgoing.value !== 'false',
                        propLabel = item.propLabel?.value ?? item.prop.value.replace(/^.*[#/]/, '');
                    let node, id;
                    if (highCardinality) {
                        node = {
                            highCardinality: true,
                            prop: item.prop.value,
                            propLabel,
                            count: item.count.value,
                            id: `${item.prop.value} hc`,
                            outgoing,
                        };
                        node.index = nodes.push(node) - 1;
                        id = node.id;
                    } else {
                        node = addItem(item);
                        id = `${item.prop.value} ${item.resource.value} ${outgoing}`;
                    }
                    links.push({
                        source: outgoing ? sourceNode : node,
                        target: outgoing ? node : sourceNode,
                        prop: item.prop.value,
                        desc: item.propDesc?.value || null,
                        label: propLabel,
                        id,
                        outgoing,
                    });
                    links[links.length - 1].index = links.length - 1;
                };

                data.links.forEach(i => addLink(i, false));
                data.highCardinality.forEach(i => addLink(i, true));
                update();

                return d3.json(`${baseUrl}/neighbors/tabs`);
            })
            .then(tabs => {
                if (!tabs['@graph'] || !tabs['@graph'].length) {
                    return;
                }
                tabs = tabs['@graph'].map(tab => {
                    const {fNodes, fLinks} = applyFilters(nodes, links, tab.hasFilter);
                    return {
                        ...tab,
                        fNodes,
                        fLinks,
                    };
                }).filter(tab => tab.fNodes.length && tab.fLinks.length);

                tabs.unshift({ '@id': 0, label: 'All items' })

                const tabItems = wrapper.insert('div', ':first-child')
                    .attr('class', 'tabs')
                    .selectAll('.tab')
                    .data(tabs, d => d['@id'])
                    .join(enter => enter.append('a')
                        .attr('href', '#')
                        .attr('class', 'tab')
                        .classed('active', (d, i) => !i)
                        .text(d => d.label)
                    )
                    .on('click', function(ev, d) {
                        ev.preventDefault();
                        const $this = d3.select(this);
                        if ($this.classed('active')) {
                            return;
                        }
                        tabItems.classed('active', false);
                        $this.classed('active', true);
                        update(d.fNodes || nodes, d.fLinks || links);
                    });
            });
    });
};
