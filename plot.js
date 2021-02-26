function init() {
    loadData().then(files => {
        var nodes = files[0];
        var links = files[1];
        var data = {
            nodes,
            links
        };
        data = preprocess(data);
        drawChart(data);
    })
}

function loadData() {
    return Promise.all([
        d3.csv("/chart_data/cooc32long_bw_nodelist.csv"),
        d3.csv("/chart_data/cooc32long_bw_edgelist.csv")
    ]);
}

function preprocess(data) {
    data.nodes = data.nodes.map(d => {
        return {
            id: d.id,
            label: d.label,
            bw_count: parseInt(d.bw_count),
            bw_diff: parseInt(d.bw_diff),
            bw_which: d.bw_which,
            b_count: parseInt(d.bw_count),
            w_count: parseInt(d.w_count),
            louvain: parseInt(d.louvain),
            fstgrdy: parseInt(d.fstgrdy)
        }
    });
    return data;
}

function drawChart(data) {
    var width = 600;
    var height = 600; 

    var svg = d3.select('#chart')
      .append('svg')
        .attr('viewBox', [0, 0, width, height]);

    const g = svg.append('g')
        .attr('cursor', 'grab');

    var link = g.append('g')
        .attr('stroke', '#999')
        .attr('stroke-opacity', 0.6)
      .selectAll('line')
      .data(data.links)
      .enter()
      .append('line')
      .attr("data-source", d => d.source)
      .attr("data-target", d => d.target);

    var node = g.append('g')
      .selectAll('.node')
      .data(data.nodes)
      .enter()
      .append('g')
        .attr('class', '.node');

    var radiusScale = d3.scaleLinear()
        .domain([0, d3.max(data.nodes.map(d => d.bw_count))])
        .range([2, 20]);

    var colorScale = d3.scaleSequential()
        .domain([d3.min(data.nodes.map(d => d.louvain)), d3.max(data.nodes.map(d => d.louvain))])
        .interpolator(d3.interpolateViridis);

    function filterOutText(d) {
        if (radiusScale(d.bw_count) > 2) return false;
        else return true;
    }

    node.append('circle')
        .attr('r', d => radiusScale(d.bw_count))
        .attr('data-label', d => d.label)
        .style('fill', d => colorScale(d.louvain))
        .on("mouseover", function(d) {     
            var thisNode = d3.select(this);
            var text = d3.select(this.parentNode).selectAll('text');        
            var label = text.nodes().map(d => d.innerHTML)[0];

            var neighbors = [];
            link.filter(d => {
                if (d.source.label == label) neighbors.push(d.target);
                if (d.target.label == label) neighbors.push(d.source);
                return !(d.source.label == label || d.target.label == label);
            })
              .attr("stroke-opacity", 0.1);

            var neighbor_labels = new Map(neighbors.map(d => [d.id, d.label]));
            var neighbor_nodes = node.filter(d => neighbor_labels.has(d.id));
            var other_nodes = node.filter(d => !neighbor_labels.has(d.id));

            neighbor_nodes.selectAll('text')
              .attr('visibility', 'visible');

            // reduce opacity of other nodes
            other_nodes.selectAll('circle')
              .attr('opacity', 0.1);

            other_nodes.selectAll('text')
              .attr('visibility', 'hidden');

            // for some reason, the node hovered over is captured by the other_nodes, so increase opacity and show label
            thisNode  
              .attr('opacity', 1);
            
            text
              .attr('visibility', 'visible')

        })
        .on("mouseout", function(d) {
            var text = d3.select(this.parentNode).selectAll('text');
            text
              .attr('font-weight', 'normal')
              .attr('visbility', 'hidden');

            var label = text.nodes().map(d => d.innerHTML)[0];
            var neighbors = [];
            link.filter(d => { 
                if (d.source.label == label) neighbors.push(d.target);
                if (d.target.label == label) neighbors.push(d.source);
                return !(d.source.label == label || d.target.label == label);
            })
              .attr("stroke-opacity", 0.6);

            var neighbor_labels = new Map(neighbors.map(d => [d.id, d.label]));
            var neighbor_nodes = node.filter(d => neighbor_labels.has(d.id));
            var other_nodes = node.filter(d => !neighbor_labels.has(d.id));

            node.selectAll('circle')
                .attr('opacity', 1);
            
            node.selectAll('text')
                .attr('visibility', d => filterOutText(d) ? 'hidden' : 'visible');
        });

    node.append('text')
        .attr('dx', d => radiusScale(d.bw_count) + "px")
        .attr('dy', '.4em')
        .attr('fill', 'black')
        .attr('font-size', '.8em')
        .attr('visibility', d => filterOutText(d) ? 'hidden' : 'visible')
        .text(d => d.label);

    var simulation = d3.forceSimulation(data.nodes)
        .force('link', d3.forceLink().id(function(d) { return d.id; }).links(data.links))
        .force('charge', d3.forceManyBody())
        .force('center', d3.forceCenter(width / 2, height / 2))
        .on('tick', ticked);

    svg.call(d3.zoom()
        .extent([[0, 0], [width, height]])
        .scaleExtent([1/8, 8])
        .on("zoom", zoomed));

    function ticked() {
        function getX(d) {
            console.log(d);
            var radius = radiusScale(d.bw_count);
            return Math.max(radius, Math.min(width - radius, d.x));
        }

        function getY(d) {
            var radius = radiusScale(d.bw_count);
            return Math.max(radius, Math.min(height - radius, d.y));
        }

        node
            .attr('transform', d => `translate(${d.x},${d.y})`);
        link
          .attr('x1', function(d) { return d.source.x; })
          .attr('y1', function(d) { return d.source.y; })
          .attr('x2', function(d) { return d.target.x; })
          .attr('y2', function(d) { return d.target.y; })
    }

    function zoomed({transform}) {
        g.attr('transform', transform);
    }

    function drag(simulation) {
        function dragstarted(event) {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            event.subject.fx = event.subject.x;
            event.subject.fy = event.subject.y;
        }

        function dragged(event) {
            event.subject.fx = event.x;
            event.subject.fy = event.y;
        }

        function dragended(event) {
            if (!event.active) simulation.alphaTarget(0);
            event.subject.fx = null;
            event.subject.fy = null;
        }

        return d3.drag()
            .on("start", dragstarted)
            .on("drag", dragged)
            .on("end", dragended);
    }


}