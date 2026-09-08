import { reactive, html, component } from "https://esm.sh/@arrow-js/core@1.0.6"

const state = reactive({})
const global = {}

//--------------------------------------------------------------------------------
//---------------------------------------- Init ----------------------------------
//--------------------------------------------------------------------------------
const init = async () => {
  await loadData()
  loadURL()
  html`${Root()}`(document.body)
}

//--------------------------------------------------------------------------------
//---------------------------------------- Data ----------------------------------
//--------------------------------------------------------------------------------
const loadData = async () => {
  const files = [ "skills", "classes", "meta" ]
  const folder = location.origin + location.pathname
  const promises = await Promise.all(files.map(file => fetch(`${folder}${file}.json)`)))

  promises.forEach((promise, i) => {
    const file = files[i]

    if (promise.status == "fulfilled")
      global[file] = JSON.parse(promise.value)
    else
      console.warn(`Failed loading: ${file}.json`)
  })

  state.currentClass = 0
  state.currentLevel = 1
  state.currentRetirement = 0
  state.skillAllocation = Object.keys(global.skills).map(k => ({ [k]: 0 }))
  state.freeSp = 0
  state.totalSp = global.meta.initialSp + (global.meta.spPerLevel * state.currentLevel) + state.currentRetirement
}

//--------------------------------------------------------------------------------
//---------------------------------------- Functions -----------------------------
//--------------------------------------------------------------------------------
const changeClass = () => {
  state.skillAllocation = Object.keys(global.skills).map(k => ({ [k]: 0 }))
  state.freeSp = 0
  state.totalSp = global.meta.initialSp + (global.meta.spPerLevel * state.currentLevel) + state.currentRetirement

  saveURL()
}

//----------------------------------------
const changeSp = () => {
  state.totalSp = global.meta.initialSp + (global.meta.spPerLevel * state.currentLevel) + state.currentRetirement

  saveURL()
}

//----------------------------------------
const increaseSkill = (skill, points = 1) => {
  Object.entries(global.skills[skill].upstream).forEach(([ k, v ]) => {
    if (state.skillAllocation[k] < v)
      increaseSkill(k, v - state.skillAllocation[k])
  })

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

  Object.entries(global.skills[skill].downstream).forEach(([ k, v ]) => {
    if (state.skillAllocation[k] > 0 && state.skillAllocation[skill] < global.skills[k].upstream[skill])
      decreaseSkill(k, state.skillAllocation[k])
  })

  saveURL()
}

//--------------------------------------------------------------------------------
//---------------------------------------- Components ----------------------------
//--------------------------------------------------------------------------------
const Root = component(() => {
  return html`
    ${Controls()}
    <div class="skill-grid">
      ${() => state.skillAllocation.map(item => Skill(item).key(item.name))}
    </div>`
})

//----------------------------------------
const Controls = component(() => {
  return html`
    <div class="controls">
      <div class="logo">
        <img src="images/Etrian_Odyssey_logo.png" height="100px"></img>
      </div>

      <div class="class-selection">
        <span>Class: </span>
        ${Select({ options: global.classes.map((item, value) => ({ value, text: item.name })), handleChange: changeClass })}
      </div>

      <div class="level-selection">
        <span>Level: </span>
        <input type="number" name="level" class="" @change="${changeSp}">
      </div>

      <div class="retirement-selection">
        <span>Retirement: </span>
        ${Select({ options: global.meta.retirementData, handleChange: changeSp })}
      </div>

      <div class="sp-count">
        <span>SP: ${() => state.freeSp} / ${() => state.totalSp}</span>
      </div>
    </div>`
})

//----------------------------------------
const Skill = component(props => {
  const classes = () => createClasses({
    "skill": true,
    "disabled": Object.entries(global.skills[props.name].upstream).some(([ k, v ]) => state.skillAllocation[k] < v)
  })

  const level = () => {
    if (!props.maxLevel)
      return ""

    return `${global.skillAllocation[props.name]}/${props.maxLevel}`
  }

  return html`
    <div class="${classes}">
      <div class="skill-header">
        <div>${props.name}</div>
        <div>${level}</div>
      </div>
      <div class="skill-buttons">
        ${Button({
          text: "-",
          handleClick:() => decreaseSkill(props.name)
        })}
        ${Button({
          text: "+",
          handleClick:() => increaseSkill(props.name)
        })}
      </div>
    </div>`
})

//----------------------------------------
const Button = component(props => {
  const classes = () => createClasses({
    "button": true,
    "disabled": false
  })

  return html`
    <button class="${classes}" @click="${props.handleClick}">${props.text}</button>`
})

//--------------------------------------------------------------------------------
//---------------------------------------- Template Components -------------------
//--------------------------------------------------------------------------------
const Select = component(props => {
  return html`
    <select @change="${props.handleChange}">
      ${() => props.options.map(item => Option(item).key(item.value))}
    </select>`
})

//----------------------------------------
const Option = component(props => {
  return html`
    <option value="${props.value}">${props.text}</option>`
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

  const data = JSON.parse(LZString.decompressFromEncodedURIComponent(location.hash))

  Object.entries(data).forEach(([ k, v ]) => state[k] = v)

  /*
  var i = 0

  for (var skill in $scope.class.classData[$scope.class.selected].skills) {
    $scope.skillAllocation[$scope.class.classData[$scope.class.selected].skills[skill]] = $scope.saveData.Skills[i]
    $scope.skillPoints.usedSkillPoints += $scope.saveData.Skills[i] == undefined
      ? 0
      : $scope.saveData.Skills[i]
    i++
  }

  const retiredSp = $scope.retirement.retirementData[$scope.retirement.selected] || 0

  $scope.skillPoints.totalSkillPoints = parseInt($scope.skillPoints.initialSP) + parseInt($scope.level.selected) + parseInt(retiredSp)
  //*/
}

//----------------------------------------
const saveURL = () => {
  const keys = [ "currentClass", "currentLevel", "currentRetirement", "skillAllocation" ]
  const data = {}

  keys.forEach(key => data[key] = state[key])

  const dataURI = LZString.compressToEncodedURIComponent(JSON.stringify(data))

  history.replaceState(null, "", `#${dataURI}`)
  //location.hash = dataURI
}

//----------------------------------------
const drawLine = (skill, element) => {
  /*
  Object.keys(global.skills[skill].upstream).forEach(upstream =>
    const template =
      '<svg class="line" width="1000" height="805"><marker id="mid" markerWidth="10" markerHeight="10" refX="0" refY="3" orient="auto" markerUnits="strokeWidth"><path d="M0,0 L0,6 L9,3 z" fill="navy" /></marker>' +
      '<polyline id="' +
      upstream +
      '-' +
      skill +
      '" marker-mid="url(#mid)"  points="' +
      (180 * parseInt($scope.skills[upstream].Location.x) + 55) +
      ',' +
      (70 + 100 * parseInt($scope.skills[upstream].Location.y)) +
      ' ' +
      (180 * parseInt($scope.skills[skill].Location.x) + 55) +
      ',' +
      (70 + 100 * parseInt($scope.skills[skill].Location.y)) +
      '"/> <rect x="' +
      ((180 * parseInt($scope.skills[skill].Location.x) +
        55 +
        (180 * parseInt($scope.skills[upstream].Location.x) + 55)) /
        2 -
        10) +
      '" y="' +
      ((70 +
        100 * parseInt($scope.skills[upstream].Location.y) +
        (70 + 100 * parseInt($scope.skills[skill].Location.y))) /
        2 -
        10) +
      '" width="20" height="20" fill="#7373b9"></rect> <text stroke="navy" text-anchor="middle" x="' +
      (180 * parseInt($scope.skills[skill].Location.x) +
        55 +
        (180 * parseInt($scope.skills[upstream].Location.x) + 55)) /
        2 +
      '" y="' +
      ((70 +
        100 * parseInt($scope.skills[upstream].Location.y) +
        (70 + 100 * parseInt($scope.skills[skill].Location.y))) /
        2 +
        5) +
      '"> ' +
      $scope.skills[skill].Upstream[upstream] +
      '</text></svg>';

    element.append(template);
    midMarkers(document.getElementById(upstream + '-' + skill), 10);
  })
  //*/
}

//----------------------------------------
// https://stackoverflow.com/questions/11808860/how-to-place-arrow-head-triangles-on-svg-lines
const midMarkers = (poly, spacing) => {
  var svg = poly.ownerSVGElement;
  for (var pts = poly.points, i = 1; i < pts.numberOfItems; ++i) {
    var p0 = pts.getItem(i - 1),
      p1 = pts.getItem(i);
    var dx = p1.x - p0.x,
      dy = p1.y - p0.y;
    var d = Math.sqrt(dx * dx + dy * dy);
    var numPoints = Math.floor(d / spacing);
    dx /= numPoints;
    dy /= numPoints;
    for (var j = numPoints - 1; j > 0; --j) {
      var pt = svg.createSVGPoint();
      pt.x = p0.x + dx * j;
      pt.y = p0.y + dy * j;
      pts.insertItemBefore(pt, i);
    }
    if (numPoints > 0) i += numPoints - 1;
  }
}

//--------------------------------------------------------------------------------
//--------------------------------------------------------------------------------
//--------------------------------------------------------------------------------
init()
