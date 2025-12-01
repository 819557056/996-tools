import { ref, shallowRef } from 'vue'
import { useToast } from '@/composables/useToast'
import JSON5 from 'json5'
import * as echarts from 'echarts'

export type VisualizationType = 'tree' | 'graph' | 'sunburst'

export function useJsonVisualizer() {
  const { toast } = useToast()

  const inputJson = ref('')
  const error = ref('')
  const visualizationType = ref<VisualizationType>('tree')
  const chartInstance = shallowRef<echarts.ECharts | null>(null)
  const chartContainer = ref<HTMLElement | null>(null)

  function validateAndParse() {
    if (!inputJson.value.trim()) {
      throw new Error('请输入JSON数据')
    }
    try {
      return JSON5.parse(inputJson.value)
    } catch (e) {
      const msg = (e as Error).message
      throw new Error(`JSON解析错误: ${msg}`)
    }
  }

  function jsonToTreeData(obj: any, name: string = 'root'): any {
    if (obj === null) {
      return { name: `${name}: null`, value: 'null' }
    }

    if (Array.isArray(obj)) {
      return {
        name: `${name} [${obj.length}]`,
        children: obj.map((item, index) => jsonToTreeData(item, `[${index}]`))
      }
    }

    if (typeof obj === 'object') {
      const keys = Object.keys(obj)
      return {
        name: `${name} {${keys.length}}`,
        children: keys.map(key => jsonToTreeData(obj[key], key))
      }
    }

    // Primitive values
    const valueStr = typeof obj === 'string' ? `"${obj}"` : String(obj)
    return {
      name: `${name}: ${valueStr}`,
      value: valueStr
    }
  }

  function jsonToGraphData(obj: any, name: string = 'root', depth: number = 0): { nodes: any[], links: any[] } {
    const nodes: any[] = []
    const links: any[] = []
    let nodeIdCounter = 0

    function traverse(currentObj: any, currentName: string, parentId: string | null, currentDepth: number) {
      const nodeId = `node_${nodeIdCounter++}`
      
      if (currentObj === null) {
        nodes.push({
          id: nodeId,
          name: `${currentName}: null`,
          symbolSize: 20,
          category: currentDepth,
          itemStyle: { color: '#999' }
        })
        if (parentId) {
          links.push({ source: parentId, target: nodeId })
        }
        return
      }

      if (Array.isArray(currentObj)) {
        nodes.push({
          id: nodeId,
          name: `${currentName} [${currentObj.length}]`,
          symbolSize: Math.min(60, 20 + currentObj.length * 2),
          category: currentDepth,
          itemStyle: { color: '#5470c6' }
        })
        if (parentId) {
          links.push({ source: parentId, target: nodeId })
        }

        currentObj.forEach((item, index) => {
          traverse(item, `[${index}]`, nodeId, currentDepth + 1)
        })
        return
      }

      if (typeof currentObj === 'object') {
        const keys = Object.keys(currentObj)
        nodes.push({
          id: nodeId,
          name: `${currentName} {${keys.length}}`,
          symbolSize: Math.min(60, 20 + keys.length * 2),
          category: currentDepth,
          itemStyle: { color: '#91cc75' }
        })
        if (parentId) {
          links.push({ source: parentId, target: nodeId })
        }

        keys.forEach(key => {
          traverse(currentObj[key], key, nodeId, currentDepth + 1)
        })
        return
      }

      // Primitive
      const valueStr = typeof currentObj === 'string' ? `"${currentObj}"` : String(currentObj)
      const displayName = currentName.length + valueStr.length > 30 
        ? `${currentName}: ${valueStr.substring(0, 20)}...`
        : `${currentName}: ${valueStr}`
        
      nodes.push({
        id: nodeId,
        name: displayName,
        symbolSize: 15,
        category: currentDepth,
        itemStyle: { color: '#fac858' }
      })
      if (parentId) {
        links.push({ source: parentId, target: nodeId })
      }
    }

    traverse(obj, name, null, depth)
    return { nodes, links }
  }

  function jsonToSunburstData(obj: any, name: string = 'root'): any {
    if (obj === null) {
      return { name: `${name}: null`, value: 1 }
    }

    if (Array.isArray(obj)) {
      if (obj.length === 0) {
        return { name: `${name} []`, value: 1 }
      }
      return {
        name: `${name} [${obj.length}]`,
        children: obj.map((item, index) => jsonToSunburstData(item, `[${index}]`))
      }
    }

    if (typeof obj === 'object') {
      const keys = Object.keys(obj)
      if (keys.length === 0) {
        return { name: `${name} {}`, value: 1 }
      }
      return {
        name: `${name} {${keys.length}}`,
        children: keys.map(key => jsonToSunburstData(obj[key], key))
      }
    }

    // Primitive
    const valueStr = typeof obj === 'string' ? `"${obj}"` : String(obj)
    return {
      name: `${name}: ${valueStr}`,
      value: 1
    }
  }

  function visualize() {
    error.value = ''
    
    try {
      const parsed = validateAndParse()

      if (!chartContainer.value) {
        throw new Error('图表容器未初始化')
      }

      // Dispose old chart instance
      if (chartInstance.value) {
        chartInstance.value.dispose()
      }

      // Create new chart instance
      chartInstance.value = echarts.init(chartContainer.value)

      let option: echarts.EChartsOption

      switch (visualizationType.value) {
        case 'tree':
          option = getTreeOption(parsed)
          break
        case 'graph':
          option = getGraphOption(parsed)
          break
        case 'sunburst':
          option = getSunburstOption(parsed)
          break
        default:
          option = getTreeOption(parsed)
      }

      chartInstance.value.setOption(option)

      toast({ title: '可视化成功', variant: 'success', duration: 2000 })
    } catch (e) {
      error.value = (e as Error).message
    }
  }

  function getTreeOption(data: any): echarts.EChartsOption {
    return {
      tooltip: {
        trigger: 'item',
        triggerOn: 'mousemove'
      },
      series: [
        {
          type: 'tree',
          data: [jsonToTreeData(data, 'root')],
          top: '5%',
          left: '10%',
          bottom: '5%',
          right: '20%',
          symbolSize: 7,
          label: {
            position: 'left',
            verticalAlign: 'middle',
            align: 'right',
            fontSize: 12
          },
          leaves: {
            label: {
              position: 'right',
              verticalAlign: 'middle',
              align: 'left'
            }
          },
          emphasis: {
            focus: 'descendant'
          },
          expandAndCollapse: true,
          animationDuration: 550,
          animationDurationUpdate: 750,
          initialTreeDepth: 3
        }
      ]
    }
  }

  function getGraphOption(data: any): echarts.EChartsOption {
    const { nodes, links } = jsonToGraphData(data, 'root')
    
    // Create categories for different depths
    const maxDepth = Math.max(...nodes.map((n: any) => n.category || 0))
    const categories = Array.from({ length: maxDepth + 1 }, (_, i) => ({ name: `Level ${i}` }))

    return {
      tooltip: {},
      legend: [
        {
          data: categories.map(c => c.name),
          orient: 'vertical',
          right: 10,
          top: 'center'
        }
      ],
      series: [
        {
          type: 'graph',
          layout: 'force',
          data: nodes,
          links: links,
          categories: categories,
          roam: true,
          label: {
            show: true,
            position: 'right',
            formatter: '{b}'
          },
          labelLayout: {
            hideOverlap: true
          },
          emphasis: {
            focus: 'adjacency',
            label: {
              show: true
            }
          },
          force: {
            repulsion: 200,
            gravity: 0.1,
            edgeLength: [50, 100],
            layoutAnimation: true
          }
        }
      ]
    }
  }

  function getSunburstOption(data: any): echarts.EChartsOption {
    return {
      tooltip: {
        trigger: 'item'
      },
      series: [
        {
          type: 'sunburst',
          data: [jsonToSunburstData(data, 'root')],
          radius: [0, '90%'],
          label: {
            rotate: 'radial',
            fontSize: 11
          },
          itemStyle: {
            borderRadius: 7,
            borderWidth: 2,
            borderColor: '#fff'
          },
          emphasis: {
            focus: 'ancestor'
          },
          levels: [
            {},
            {
              r0: '15%',
              r: '35%',
              itemStyle: {
                borderWidth: 2
              },
              label: {
                rotate: 0
              }
            },
            {
              r0: '35%',
              r: '70%',
              label: {
                align: 'right'
              }
            },
            {
              r0: '70%',
              r: '72%',
              label: {
                position: 'outside',
                padding: 3,
                silent: false
              },
              itemStyle: {
                borderWidth: 3
              }
            }
          ]
        }
      ]
    }
  }

  function exportImage() {
    if (!chartInstance.value) {
      toast({ title: '请先生成可视化', variant: 'destructive', duration: 2000 })
      return
    }

    const url = chartInstance.value.getDataURL({
      type: 'png',
      pixelRatio: 2,
      backgroundColor: '#fff'
    })

    const link = document.createElement('a')
    link.download = `json-visualization-${Date.now()}.png`
    link.href = url
    link.click()

    toast({ title: '图片已导出', variant: 'success', duration: 2000 })
  }

  function loadExample() {
    inputJson.value = `{
  "company": "Tech Corp",
  "employees": [
    {
      "id": 1,
      "name": "Alice",
      "position": "CEO",
      "department": "Management",
      "salary": 150000
    },
    {
      "id": 2,
      "name": "Bob",
      "position": "CTO",
      "department": "Engineering",
      "salary": 140000,
      "reports": [
        {
          "id": 3,
          "name": "Charlie",
          "position": "Senior Developer"
        },
        {
          "id": 4,
          "name": "Diana",
          "position": "DevOps Engineer"
        }
      ]
    }
  ],
  "locations": ["New York", "San Francisco"],
  "founded": 2015,
  "isPublic": false
}`
    setTimeout(visualize, 100)
  }

  function clear() {
    inputJson.value = ''
    error.value = ''
    if (chartInstance.value) {
      chartInstance.value.clear()
    }
  }

  function initChart(container: HTMLElement) {
    chartContainer.value = container
  }

  function dispose() {
    if (chartInstance.value) {
      chartInstance.value.dispose()
      chartInstance.value = null
    }
  }

  return {
    inputJson,
    error,
    visualizationType,
    visualize,
    exportImage,
    loadExample,
    clear,
    initChart,
    dispose
  }
}

