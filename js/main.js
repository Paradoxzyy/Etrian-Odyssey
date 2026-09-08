import { reactive, html, component } from "https://esm.sh/@arrow-js/core@1.0.6"

const global = reactive({})

const folder = location.origin + location.pathname
const promises = await Promise.all([
  fetch(`${folder}Skills.json`),
  fetch(`${folder}Classes.json`),
  fetch(`${folder}Meta.json`)
])

// Skills
if (promises[0].status == "fulfilled")
  global.skills = JSON.parse(promises[0].value)

// Classes
if (promises[1].status == "fulfilled") {
  global.classData = JSON.parse(promises[1].value)
  global.classes = Object.keys(global.classData)
  global.selectedClass = global.classData[0].name
}

// Meta
if (promises[2].status == "fulfilled") {
  const data = JSON.parse(promises[2].value)

  global.skillAllocation = {}
  global.currentLevel = data.maxLevel
  global.maxLevel = data.maxLevel

  global.skillPoints = {
    initialSP: parseInt(data.initialSP),
    totalSkillPoints: parseInt(data.initialSP) + 1,
    usedSkillPoints: 0
  }

  global.retirement = {
    selected: data.retirementData[0][0],
    retirementData: data.retirementData,
    retirements: Object.keys(data.retirementData)
  }
}

//--------------------------------------------------------------------------------
//---------------------------------------- Functions -----------------------------
//--------------------------------------------------------------------------------
const loadURL = () => {
  if (!location.hash)
    return

  const data = JSON.parse(LZString.decompressFromEncodedURIComponent(location.hash))

  /*
  global.class.selected = data.class;
  global.level.selected = data.level;
  global.retirement.selected = data.retirement;

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
  const data = {
    class: global.selectedClass,
    level: global.currentLevel,
    retirement: global.retirement.selected,
    skills: global.skillAllocation
  }

  const dataURI = LZString.compressToEncodedURIComponent(JSON.stringify(data))

  history.replaceState(null, "", `#${dataURI}`)
}

//----------------------------------------
const updateClass = () => {
  global.skillAllocation = {}
  global.skillPoints.usedSkillPoints = 0

  /*
  for (var skill in $scope.class.classData[$scope.class.selected].skills) {
    $scope.skillAllocation[
      $scope.class.classData[$scope.class.selected].skills[skill]
    ] = 0
  }
  //*/

  saveURL()
}

//----------------------------------------
const updateSP = () => {
  const retiredSp = global.retirement.retirementData[global.retirement.selected] || 0

  global.skillPoints.totalSkillPoints = parseInt(global.skillPoints.initialSP) + parseInt(global.currentLevel) + parseInt(retiredSp)

  saveURL()
}

//----------------------------------------
const increasePoint = (skill, points = 1) => {
  /*
  for (upstream in $scope.skills[skill].Upstream) {
    if ($scope.skillAllocation[upstream] < $scope.skills[skill].Upstream[upstream])
      $scope.increasePoint(upstream, $scope.skills[skill].Upstream[upstream] - $scope.skillAllocation[upstream])
  }

  if ($scope.skillAllocation[skill] < $scope.skills[skill].MaxLevel) {
    $scope.skillAllocation[skill] += points
    $scope.skillPoints.usedSkillPoints += points
  }
  //*/

  saveURL()
}

//----------------------------------------
const decreasePoint = (skill, points = 1) => {
  /*
  if ($scope.skillPoints.usedSkillPoints > 0 && $scope.skillAllocation[skill] >= points) {
    $scope.skillAllocation[skill] -= points
    $scope.skillPoints.usedSkillPoints -= points
  }

  for (downstream in $scope.skills[skill].Downstream) {
    if ($scope.skillAllocation[downstream] > 0 && $scope.skillAllocation[skill] < $scope.skills[downstream].Upstream[skill])
      $scope.decreasePoint(downstream, $scope.skillAllocation[downstream])
  }
  //*/

  saveURL()
}

//----------------------------------------
const isSkillDisabled = skill => {
  return global.skills[skill].Upstream.some(upstream => global.skillAllocation[upstream] < global.skills[skill].Upstream[upstream])
}

//--------------------------------------------------------------------------------
//---------------------------------------- Components ----------------------------
//--------------------------------------------------------------------------------
const Root = component(() => {
  return html`
    ${Controls()}
    <div class="skill-grid">
      ${() => global.skillAllocation.map(item => Skill(item).key(item.name))}
    </div>`
})

//----------------------------------------
const Controls = component(() => {
  const handleChange = e => {
    console.log(e)
  }

  return html`
    <div class="controls">
      <div class="logo">
        <img src="images/Etrian_Odyssey_logo.png" height="100px"></img>
      </div>

      <div class="class-selection">
        <span>Class: </span>
        ${Select({ options: global.classes, handleChange })}
      </div>

      <div class="level-selection">
        <span>Level: </span>
        <input type="number" name="level" class="" @change="${handleChange}">
      </div>

      <div class="retirement-selection">
        <span>Retirement: </span>
        ${Select({ options: global.retirementData, handleChange })}
      </div>

      <div class="sp-count">
        <span>SP: ${() => global.skillPoints.usedSkillPoints} / ${() => global.skillPoints.totalSkillPoints}</span>
      </div>
    </div>`
})

//----------------------------------------
const Skill = component(props => {
  const classes = () => createClasses({
    "skill": true,
    "disabled": isSkillDisabled(props.name)
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
          handleClick:() => decreasePoint(props.name)
        })}
        ${Button({
          text: "+",
          handleClick:() => increasePoint(props.name)
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

//--------------------------------------------------------------------------------
//---------------------------------------- Init ----------------------------------
//--------------------------------------------------------------------------------
loadURL()
html`${Root()}`(document.body)
