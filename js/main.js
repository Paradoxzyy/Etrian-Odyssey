import { reactive, html, svg, component, watch } from "https://esm.sh/@arrow-js/core@1.0.6"

// Hacks
HTMLCollection.prototype.forEach = Array.prototype.forEach

const state = reactive({})
const global = {}

//--------------------------------------------------------------------------------
//---------------------------------------- Init ----------------------------------
//--------------------------------------------------------------------------------
const init = async () => {
  await loadData()

  state.currentClass = 0
  state.currentLevel = 1
  state.currentRetirement = 0
  changeClass()
  loadURL()
  changeSp()

  html`${Root()}`(document.body)

  handleDrawLines()
  watch(() => state.skillAllocation, handleDrawLines)
}

//--------------------------------------------------------------------------------
//---------------------------------------- Data ----------------------------------
//--------------------------------------------------------------------------------
const loadData = async () => {
  const files = [ "skills", "classes", "meta" ]
  const folder = location.origin + location.pathname
  const promises = await Promise.allSettled(files.map(file => fetch(`${folder}${file}.json`).then(res => res.json())))

  promises.forEach((promise, i) => {
    const file = files[i]

    if (promise.status == "fulfilled")
      global[file] = Object.freeze(promise.value)
    else
      console.warn(`Failed loading: ${file}.json`)
  })

  Object.entries(global.skills).forEach(([ id, skill ]) => {
    if (!skill.upstream)
      return

    Object.entries(skill.upstream).forEach(([ k, v ]) => {
      global.skills[k].downstream ??= {}
      global.skills[k].downstream[id] = v
    })
  })
}

//--------------------------------------------------------------------------------
//---------------------------------------- Functions -----------------------------
//--------------------------------------------------------------------------------
const changeClass = () => {
  state.skillAllocation = global.classes[state.currentClass].skills.reduce((acc, curr) => (acc[curr] = 0, acc), {})
}

//----------------------------------------
const changeSp = () => {
  state.totalSp = global.meta.initialSp + (global.meta.spPerLevel * state.currentLevel) + state.currentRetirement
  state.freeSp = Object.values(state.skillAllocation).reduce((acc, curr) => acc -= curr, state.totalSp)
}

//----------------------------------------
const increaseSkill = (skill, points = 1) => {
  if (global.skills[skill].upstream) {
    Object.entries(global.skills[skill].upstream).forEach(([ k, v ]) => {
      if (state.skillAllocation[k] < v)
        increaseSkill(k, v - state.skillAllocation[k])
    })
  }

  if (state.skillAllocation[skill] < global.skills[skill].maxLevel) {
    state.skillAllocation[skill] += points
    state.freeSp -= points
  }

  saveURL()
}

//----------------------------------------
const decreaseSkill = (skill, points = 1) => {
  if (state.skillAllocation[skill] >= points) {
    state.skillAllocation[skill] -= points
    state.freeSp += points
  }

  if (global.skills[skill].downstream) {
    Object.entries(global.skills[skill].downstream).forEach(([ k, v ]) => {
      if (state.skillAllocation[k] > 0 && state.skillAllocation[skill] < global.skills[k].upstream[skill])
        decreaseSkill(k, state.skillAllocation[k])
    })
  }

  saveURL()
}

//--------------------------------------------------------------------------------
//---------------------------------------- Components ----------------------------
//--------------------------------------------------------------------------------
const Root = component(() => {
  return html`
    <div class="header">
      <div class="home">
        <a href="https://paradoxzyy.github.io/Etrian-Odyssey/" title="Home">
          <svg viewBox="0 0 640 640">
            <path d="M304 70.1C313.1 61.9 326.9 61.9 336 70.1L568 278.1C577.9 286.9 578.7 302.1 569.8 312C560.9 321.9 545.8 322.7 535.9 313.8L527.9 306.6L527.9 511.9C527.9 547.2 499.2 575.9 463.9 575.9L175.9 575.9C140.6 575.9 111.9 547.2 111.9 511.9L111.9 306.6L103.9 313.8C94 322.6 78.9 321.8 70 312C61.1 302.2 62 287 71.8 278.1L304 70.1zM320 120.2L160 263.7L160 512C160 520.8 167.2 528 176 528L224 528L224 424C224 384.2 256.2 352 296 352L344 352C383.8 352 416 384.2 416 424L416 528L464 528C472.8 528 480 520.8 480 512L480 263.7L320 120.3zM272 528L368 528L368 424C368 410.7 357.3 400 344 400L296 400C282.7 400 272 410.7 272 424L272 528z" />
          </svg>
        </a>
      </div>

      <div class="logo">
        <img src="images/Etrian_Odyssey_logo.png" height="100px" alt="Etrian Odyssey Logo" />
      </div>

      ${Controls()}
    </div>

    <div class="main">
      ${SkillGrid()}
      ${SvgGrid()}
    </div>

    <div class="footer">
      <div>
        <a href="https://github.com/Paradoxzyy/Etrian-Odyssey" target="_blank">
          <img src="https://img.shields.io/badge/github-repo-blue?logo=github" alt="GitHub Logo" />
        </a>
      </div>
    </div>`
})

//----------------------------------------
const Controls = component(() => {
  const handleChangeClass = e => {
    state.currentClass = +e.target.value
    changeClass()
    changeSp()
    saveURL()
  }

  const handleChangeLevel = e => {
    const value = Math.max(Math.min(+e.target.value, e.target.max), e.target.min)

    if (+e.target.value != value)
      e.target.value = value

    state.currentLevel = value
    changeSp()
    saveURL()
  }

  const handleChangeRetirement = e => {
    state.currentRetirement = +e.target.value
    changeSp()
    saveURL()
  }

  return html`
    <div class="controls-container">
      <div class="controls">
        <div>
          <label>
            <span>Class</span>
            ${Select({ name: "class", options: global.classes.map((item, value) => ({ value, text: item.name })), default: state.currentClass, handleChange: handleChangeClass })}
          </label>
        </div>

        <div>
          <label>
            <span>Level</span>
            <input type="number" min="1" max="${global.meta.maxLevel}" value="${state.currentLevel}" name="level" @change="${handleChangeLevel}">
          </label>
        </div>

        <div>
          <label>
            <span>Retirement</span>
            ${Select({ name: "retirement", options: global.meta.retirementData, default: state.currentRetirement, handleChange: handleChangeRetirement })}
          </label>
        </div>
      </div>

      <div>
        <span>SP: <span class="${() => state.freeSp < 0 ? "overspend" : ""}">${() => state.freeSp}</span> / ${() => state.totalSp}</span>
      </div>
    </div>`
})

//----------------------------------------
const SkillGrid = component(() => {
  const gridSize = Object.values(global.skills).reduce((acc, curr) => {
    acc.x.push(curr.location.x)
    acc.y.push(curr.location.y)

    return acc
  }, { x: [ 0 ], y: [ 0 ] })

  gridSize.x = Math.max(...gridSize.x) + 1
  gridSize.y = Math.max(...gridSize.y) + 1

  const data = () => Object.keys(state.skillAllocation)
    .reduce((acc, curr) => {
      const item = global.skills[curr]

      // TODO verify all skills exist in skills.json
      if (!item)
        return acc

      const index = item.location.x + gridSize.x * item.location.y
      item.id = curr
      acc[index] = item

      return acc
    }, Array(gridSize.x * gridSize.y).fill(null))
    .map((item, i) => SkillContainer(item).key(`${state.currentClass}-${i}`))

  return html`
    <div class="skill-grid" data-columns="${gridSize.x}">
      ${data}
    </div>`
})

//----------------------------------------
const SvgGrid = component(() => {
  const data = () => Object.keys(state.skillAllocation).map(id => LineContainer({ id }).key(`${state.currentClass}-${id}`))

  return html`
    <div class="svg-grid">
      ${data}
    </div>`
})

//----------------------------------------
const SkillContainer = component(props => {
  if (props.id)
    return html`${Skill(props)}`

  return html`<div></div>`
})

//----------------------------------------
const Skill = component(props => {
  const localState = reactive({
    showSkillInfo: false
  })

  const classes = () => createClasses({
    "skill-box": true,
    "disabled": global.skills[props.id].upstream && Object.entries(global.skills[props.id].upstream).some(([ k, v ]) => state.skillAllocation[k] < v)
  })

  const classesLevel = () => createClasses({
    "skill-points": true,
    "active": state.skillAllocation[props.id]
  })

  const toggleSkillInfo = toggle => localState.showSkillInfo = toggle
  const level = () => props.maxLevel ? `${state.skillAllocation[props.id]}/${props.maxLevel}` : ""

  const buttons = () => {
    if (!props.maxLevel)
      return ""

    return html`
      <div class="skill-buttons">
        ${() => Button({
          text: "-",
          disabled: state.skillAllocation[props.id] == 0,
          handleClick: () => decreaseSkill(props.id)
        })}
        ${() => Button({
          text: "+",
          disabled: state.skillAllocation[props.id] == props.maxLevel,
          handleClick: () => increaseSkill(props.id)
        })}
      </div>`
  }

  return html`
    <div class="skill">
      <div class="${classes}" @mouseenter="${() => toggleSkillInfo(true)}" @mouseleave="${() => toggleSkillInfo(false)}">
        <div class="skill-header">
          <div class="skill-name">${props.name}</div>
          <div class="${classesLevel}">${level}</div>
        </div>
        ${buttons}
      </div>
      ${() => SkillInfo({ ...props, showSkillInfo: localState.showSkillInfo })}
    </div>`
})

//----------------------------------------
const SkillInfo = component(props => {
  const classes = () => createClasses({
    "skill-info": true,
    "display-top": props.location.y > 3,
    "display-left": props.location.x > 3,
    "hidden": !props.showSkillInfo
  })

  const cols = Math.max(props.maxLevel, 5) + 2
  const col2 = Math.floor(cols / (props.body ? 3 : 2))
  const col1 = cols - col2 * (props.body ? 2 : 1)
  const totalLevels = props.maxLevel + (props.boostAllowed ? 5 : 0)
  // TODO update EO1/skills.json TP cost level data for boost

  return html`
    <div class="${classes}">
      <table>
        <tr>
          <th colspan="${col1}">Name</th>
          <th colspan="${col2}" class="${props.body ? "" : "hidden"}">Body Part</th>
          <th colspan="${col2}">Skill Type</th>
          <th colspan="5" rowspan="${props.body ? 3 : 2}" class="${props.boostAllowed ? "" : "hidden"}">Boost</th>
        </tr>
        <tr>
          <td colspan="${col1}">${props.name}</td>
          <td colspan="${col2}" class="${props.body ? "" : "hidden"}">${props.body}</td>
          <td colspan="${col2}">${props.type}</td>
        </tr>
        <tr>
          <td colspan="${cols}">${props.description}</td>
        </tr>
        <tr class="${!props.note ? "hidden" : ""}">
          <th colspan="${cols}">Note</td>
        </tr>
        <tr class="${!props.note ? "hidden" : ""}">
          <td colspan="${cols}">${props.note}</td>
        </tr>
        <tr class="${!props.maxLevel ? "hidden" : ""}">
          <th colspan="2">Level</th>
          ${() => Array.from(Array(totalLevels).keys()).map(i => html`<th colspan="${props.maxLevel == 1 ? 5 : 1}" class="${state.skillAllocation[props.id] == i + 1 ? "selected" : ""}">${i + 1}</th>`)}
        </tr>
        ${SkillInfoRows(props)}
      </table>
    </div>`
})

//----------------------------------------
const SkillInfoRows = component(props => {
  if (!global.skills[props.id].levelData)
    return html``

  return html`
    ${() => Object.entries(global.skills[props.id].levelData).map(([ name, data ]) => SkillInfoRow({ name, data, id: props.id, maxLevel: props.maxLevel }))}`
})

//----------------------------------------
const SkillInfoRow = component(props => {
  if (!props.maxLevel || props.data.length == 1) {
    const classes = () => createClasses({
      "selected": state.skillAllocation[props.id]
    })

    return html`
      <tr>
        <th colspan="2">${props.name}</th>
        <td colspan="${Math.max(props.maxLevel, 5)}" class="${classes}">${props.data}</td>
      </tr>`
  }

  const cells = () => props.data.reduce((acc, curr, i) => {
    if (props.data[i + 1] == curr)
      return acc

    const colspan = (() => {
      if (props.data[i - 1] != curr)
        return 1

      const prevValues = props.data.slice(0, i + 1).reverse()
      const prevIndex = prevValues.findIndex(n => n != curr)

      return prevIndex == -1 ? prevValues.length : prevIndex
    })()

    const isLevelWithinSelected = (level => {
      if (level == -1)
        return false

      if (level == i)
        return true

      return props.data.slice(Math.min(level, i), Math.max(level, i) + 1).every(v => v == props.data[level])
    })(state.skillAllocation[props.id] -1)

    const classes = () => createClasses({
      "selected": isLevelWithinSelected
    })

    acc.push(html`<td colspan="${colspan}" class="${classes}">${curr}</td>`)

    return acc
  }, [])

  return html`
    <tr>
      <th colspan="2">${props.name}</th>
      ${cells}
    </tr>`
})

//--------------------------------------------------------------------------------
//---------------------------------------- Template Components -------------------
//--------------------------------------------------------------------------------
const Select = component(props => {
  return html`
    <select name="${props.name}" @change="${props.handleChange}">
      ${() => props.options.map(item => (item.default = item.value == props.default,  Option(item).key(item.value)))}
    </select>`
})

//----------------------------------------
const Option = component(props => {
  return html`
    <option value="${props.value}" .selected="${props.default}">${props.text}</option>`
})

//----------------------------------------
const Button = component(props => {
  const classes = () => createClasses({
    "button": true,
    "disabled": props.disabled
  })

  return html`
    <button class="${classes}" @click="${props.handleClick}">${props.text}</button>`
})

//----------------------------------------
const LineContainer = component(props => {
  if (props.id)
    return html`${Line(props)}`

  return html`<div></div>`
})

//----------------------------------------
const Line = component(props => {
  // TODO why optional chaining?
  if (!global.skills[props.id]?.upstream)
    return html``

  const lines = Object.keys(global.skills[props.id].upstream).map(upstream => {
    if (!state.skillAllocation.hasOwnProperty(upstream))
      return ""

    const downskill = global.skills[props.id].location
    const upskill = global.skills[upstream].location

    // TODO use rem to calculate values
    //const rem = parseFloat(getComputedStyle(document.documentElement).fontSize)
    const getX = v => 61 + 178 * v
    const getY = v => 26 + 100 * v

    const upX = getX(upskill.x)
    const upY = getY(upskill.y)
    const downX = getX(downskill.x)
    const downY = getY(downskill.y)

    const x = (downX + upX) / 2
    const y = (upY + downY) / 2

    const points = `${upX},${upY} ${downX},${downY}`
    const id = `${upstream}-${props.id}`

    const marker = svg`
      <marker id="mid" refX="0" refY="3" orient="auto" markerWidth="10" markerHeight="10" markerUnits="strokeWidth">
        <path d="M0,0 L0,6 L9,3 z" fill="navy" />
      </marker>`

    const polyline = svg`
      <polyline id="${id}" marker-mid="url(#mid)" points="${points}">
      </polyline>`

    const rect = svg`
      <rect width="20" height="20" fill="var(--background)"
        x="${x - 10}"
        y="${y - 10}">
      </rect>`

    const text = svg`
      <text stroke="navy" text-anchor="middle"
        x="${x}"
        y="${y + 5}">
        ${global.skills[props.id].upstream[upstream]}
      </text>`

    return html`
      <svg class="line">
        ${marker}
        ${polyline}
        ${rect}
        ${text}
      </svg>`
  })

  return html`${lines}`
})

//--------------------------------------------------------------------------------
//---------------------------------------- Helper Functions ----------------------
//--------------------------------------------------------------------------------
const createClasses = classes => {
  return Object.entries(classes).reduce((acc, [ k, v ]) => {
    if (v)
      acc.push(k)

    return acc
  }, []).join(" ")
}

//----------------------------------------
const loadURL = () => {
  if (!location.hash)
    return

  const keys = [ "currentClass", "currentLevel", "currentRetirement" ]
  const data = JSON.parse(LZString.decompressFromEncodedURIComponent(location.hash.slice(1)))

  keys.forEach(key => state[key] = data[key])
  state.skillAllocation = global.classes[state.currentClass].skills.reduce((acc, curr, i) => (acc[curr] = data.skillAllocation[i] || 0, acc), {})
}

//----------------------------------------
const saveURL = () => {
  const keys = [ "currentClass", "currentLevel", "currentRetirement" ]
  const data = {}

  keys.forEach(key => data[key] = state[key])
  data.skillAllocation = global.classes[state.currentClass].skills.map(item => state.skillAllocation[item])

  const dataURI = LZString.compressToEncodedURIComponent(JSON.stringify(data))

  history.replaceState(null, "", `#${dataURI}`)
  //location.hash = dataURI
}

//----------------------------------------
const handleDrawLines = () => document.getElementsByClassName("svg-grid")[0]?.children?.forEach(child => midMarkers(child.querySelector("polyline")))

//----------------------------------------
// https://stackoverflow.com/questions/11808860/how-to-place-arrow-head-triangles-on-svg-lines
const midMarkers = poly => {
  var svg = poly.ownerSVGElement;

  for (var pts = poly.points, i = 1; i < pts.numberOfItems; ++i) {
    var p0 = pts.getItem(i - 1),
        p1 = pts.getItem(i);

    var dx = p1.x - p0.x,
        dy = p1.y - p0.y;

    var d = Math.sqrt(dx * dx + dy * dy);
    var numPoints = Math.floor(d / 16);

    dx /= numPoints;
    dy /= numPoints;

    for (var j = numPoints - 1; j > 0; --j) {
      var pt = svg.createSVGPoint();
      pt.x = p0.x + dx * j;
      pt.y = p0.y + dy * j;
      pts.insertItemBefore(pt, i);
    }

    if (numPoints > 0)
      i += numPoints - 1;
  }
}

//--------------------------------------------------------------------------------
//--------------------------------------------------------------------------------
//--------------------------------------------------------------------------------
init()
