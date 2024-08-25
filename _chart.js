let jsonData = null;

function csvToJson(csvData) {
  const urls = csvData.trim().split('\n');
  const root = { name: '', children: [] };

  urls.forEach(url => {
      try {
          const parsedUrl = new URL(url.trim());
          const path = parsedUrl.pathname.split('/').filter(Boolean);
          let currentNode = root;

          path.forEach((segment, index) => {
              let childNode = currentNode.children.find(child => child.name === `/${segment}`);

              if (!childNode) {
                  childNode = { name: `/${segment}`, children: [] };
                  currentNode.children.push(childNode);
              }

              if (index === path.length - 1) {
                  childNode.children = [];
              }

              currentNode = childNode;
          });
      } catch (error) {
          console.error(`無効なURLをスキップしました: ${url}`, error);
      }
  });

  return root;
}

document.getElementById('csvFile').addEventListener('change', function (event) {
  const file = event.target.files[0];

  if (file) {
      Papa.parse(file, {
          complete: function (results) {
              const csvData = results.data.join('\n');
              jsonData = csvToJson(csvData);

              document.getElementById('csvData').value = JSON.stringify(jsonData, null, 2);
              draw(jsonData); // 修正：jsonDataを直接使用
          },
          error: function (error) {
              console.error('CSV解析エラー:', error);
          }
      });
  }
});

// メインのツリーレンダリング関数
function _chart(d3, data, depth) {
  const width = document.body.clientWidth;
  const root = d3.hierarchy(data);

  function update(source) {
      const dx = PARAMS.Height;
      const dy = width / (root.height + 1);
      const tree = d3.tree().nodeSize([dx, dy]);
      tree(root);
      root.x0 = dx / 2;
      root.y0 = 0;
      let i = 0;

      const nodes = root.descendants().filter(d => d.depth <= depth);
      const links = root.links().filter(d => d.source.depth <= depth && d.target.depth <= depth);

      let x0 = Infinity, x1 = -x0;
      root.each(d => {
          if (d.depth <= depth) {
              if (d.x > x1) x1 = d.x;
              if (d.x < x0) x0 = d.x;
          }
      });

      const height = x1 - x0 + dx * 3;

      function toggle(d) {
          if (d.children) {
              d._children = d.children;
              d.children = null;
          } else {
              d.children = d._children;
              d._children = null;
          }
      }

      const svg = d3.select("svg")
          .attr("width", width)
          .attr("height", height)
          .attr("viewBox", [-dy / 3, x0 - dx * 2, width, height])
          .attr("preserveAspectRatio", "xMinYMid meet");

      const node = svg.selectAll('g.node')
          .data(nodes, d => d.id || (d.id = ++i));


      const nodeEnter = node.enter().append('g')
          .attr('class', 'node')
          .attr('transform', d => `translate(${source.y},${source.x})`)
          .on("click", function(d) {
              toggle(d);
              update(d);
          });
          

      nodeEnter.append('circle')
          .attr('r', 4)
          .attr('fill', d => d._children ? "#000" : "#999");

      nodeEnter.append("text")
          .attr("dy", "0.31em")
          .attr("x", d => d.children ? -6 : 6)
          .attr("text-anchor", d => d.children ? "end" : "start")
          .text(d => d.data.name)
          .attr("stroke", "white")
          .attr("stroke-width", 3)
          .attr("paint-order", "stroke");

      const nodeUpdate = nodeEnter.merge(node);

      nodeUpdate.transition()
          .duration(200)
          .attr('transform', d => `translate(${d.y},${d.x})`);

      nodeUpdate.select('circle')
          .attr('r', 5)
          .attr('fill', d => d._children ? "#000" : "#999");

      nodeUpdate.select('text')
          .style('fill-opacity', 1)
          .style("font-size", "0.7em");

      const nodeExit = node.exit()
          .transition()
          .duration(200)
          .attr('transform', d => `translate(${source.y},${source.x})`)
          .remove();

      nodeExit.select('circle')
          .attr('r', 1e-6);

      nodeExit.select('text')
          .style('fill-opacity', 1e-6);

      const link = svg.selectAll('path.link')
          .data(links, d => d.target.id);

      const linkEnter = link.enter().insert('path', 'g')
          .attr('class', 'link')
          .attr('d', d3.linkHorizontal()
              .x(d => source.y0)
              .y(d => source.x0));

      const linkUpdate = linkEnter.merge(link);

      linkUpdate.transition()
          .duration(200)
          .attr('d', d3.linkHorizontal()
              .x(d => d.y)
              .y(d => d.x));

      const linkExit = link.exit().transition()
          .duration(200)
          .attr('d', d3.linkHorizontal()
              .x(d => source.y)
              .y(d => source.x))
          .remove();

      node.each(function(d) {
          d.x0 = d.x;
          d.y0 = d.y;
      });
  }

  update(root);
}

const pane = new Tweakpane.Pane();

const PARAMS = {
  Depth: 8,
  Height: 20,
};

// Tweakpaneの設定
((folder) => {
  folder.addInput(PARAMS, 'Depth', { step: 1, min: 0, max: 10 });
  folder.addInput(PARAMS, 'Height', { step: 0.1, min: 0, max: 50 });
})(pane.addFolder({
  title: 'Parameters',
}));

pane.on('change', () => {
  draw(jsonData);
});

function draw(jsonData) {
  d3.select("body").selectAll("svg").remove();
  d3.select("body").append('svg').attr("width", 960).attr("height", 500);
  _chart(d3, jsonData, PARAMS.Depth);
}
