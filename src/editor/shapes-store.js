import { get, isObject } from "lodash";
import uuid from "uuid/v1";
import warn from "@/warn";

function initialLayersState() {
  return {
    main: {
      active: true,
      shapes: []
    },
    before: {
      active: false,
      shapes: []
    },
    after: {
      active: false,
      shapes: []
    }
  };
}

const shapes = {
  state: {
    layers: initialLayersState(),
    round: true,
    shapeToBeAdded: null
  },
  mutations: {
    addNewStop(state, { shape, index }) {
      const newStop = { color: "", position: "" };
      if (typeof index === "number") {
        shape.stops.splice(index, 0, newStop);
      } else {
        shape.stops.push(newStop);
      }
    },
    addShape(state, { layerName, shape }) {
      get(shape, "stops", []).forEach(stop => (stop.id = uuid()));
      state.layers[layerName].shapes.push(shape);
    },
    moveShape(state, { shape, left, top }) {
      if (typeof left === "object" && left.units === shape.left.units) {
        shape.left = left;
      }
      if (typeof top === "object" && top.units === shape.top.units) {
        shape.top = top;
      }
      state.layers = { ...state.layers };
    },
    moveShapeBy(state, { shape, left, top }) {
      if (typeof left === "object" && left.units === shape.left.units) {
        shape.left.value += left.value;
      }
      if (typeof top === "object" && top.units === shape.top.units) {
        shape.top.value += top.value;
      }
      state.layers = { ...state.layers };
    },
    removeShape(state, shape) {
      for (const layer of Object.values(state.layers)) {
        const index = layer.shapes.findIndex(s => s === shape);
        if (index !== -1) {
          layer.shapes.splice(index, 1);
          break;
        }
      }
      state.layers = { ...state.layers };
    },
    removeStop(state, { shape, index }) {
      shape.stops.splice(index, 1);
    },
    resizeShape(
      state,
      { shape, initialShapeProps = { ...shape }, direction, diff }
    ) {
      if (direction.includes("top")) {
        const bottom =
          initialShapeProps.top.value + initialShapeProps.height.value;
        shape.top.value = Math.min(
          initialShapeProps.top.value + diff.top,
          bottom
        );
        shape.height.value = bottom - shape.top.value;
      }
      if (direction.includes("left")) {
        const right =
          initialShapeProps.left.value + initialShapeProps.width.value;
        shape.left.value = Math.min(
          initialShapeProps.left.value + diff.left,
          right
        );
        shape.width.value = right - shape.left.value;
      }
      if (direction.includes("right")) {
        shape.width.value = Math.max(
          0,
          initialShapeProps.width.value + diff.left
        );
      }
      if (direction.includes("bottom")) {
        shape.height.value = Math.max(
          0,
          initialShapeProps.height.value + diff.top
        );
      }
      state.layers = { ...state.layers };
    },
    roundShapeProperty(state, { shape, propertyName }) {
      if (state.round) {
        const propertyObject = get(shape, propertyName);
        if (propertyObject && isObject(propertyObject)) {
          propertyObject.value = Math.round(propertyObject.value);
        } else {
          warn(`Property ${propertyName} of shape is not an object`);
        }
      }
    },
    setShapes(state, shapes) {
      state.layers = { ...initialLayersState(), ...shapes };
    },
    setShapeToBeAdded(state, shape) {
      state.shapeToBeAdded = deepCopy(shape);
    },
    toggleLayer(state, layerName) {
      state.layers[layerName].active = !state.layers[layerName].active;
    },
    unsetShapeToBeAdded(state) {
      state.shapeToBeAdded = null;
    },
    updateShape(state, { shape, ...newProps }) {
      for (const key in newProps) {
        if (isObject(shape[key]) && isObject(newProps[key])) {
          shape[key] = { ...shape[key], ...newProps[key] };
        } else {
          shape[key] = newProps[key];
        }
      }
      state.layers = { ...state.layers };
    },
    updateShapeStop(state, { shape, stop, ...newProps }) {
      for (const key in newProps) {
        if (isObject(stop[key]) && isObject(newProps[key])) {
          stop[key] = { ...stop[key], ...newProps[key] };
        } else {
          stop[key] = newProps[key];
        }
      }
      shape.stops = [...shape.stops];
    }
  },
  getters: {
    allLayers: state => state.layers,
    isLayerActive: state => layerName =>
      get(state, `layers[${layerName}].active`, false),
    layerShapes: state => layerName =>
      get(state, `layers[${layerName}].shapes`, []),
    shapes: (state, getters) => {
      let shapes = [];
      for (const layerName of ["main", "before", "active"]) {
        const isActive = getters.isLayerActive(layerName);
        if (isActive) {
          shapes = shapes.concat(getters.layerShapes(layerName));
        }
      }
      return shapes;
    },
    shapeToBeAdded: state => state.shapeToBeAdded,
    visibleShapes: (state, getters) => {
      let shapes = [];
      for (const layerName of ["main", "before", "active"]) {
        const isActive = getters.isLayerActive(layerName);
        if (isActive) {
          shapes = shapes.concat(getters.layerShapes(layerName));
        }
      }
      if (
        state.shapeToBeAdded &&
        typeof get(state, "shapeToBeAdded.top.value") === "number" &&
        typeof get(state, "shapeToBeAdded.left.value") === "number" &&
        typeof get(state, "shapeToBeAdded.width.value") === "number" &&
        typeof get(state, "shapeToBeAdded.height.value") === "number"
      ) {
        shapes.push(state.shapeToBeAdded);
      }
      return shapes;
    }
  },
  actions: {
    addNewStop({ commit, dispatch }, { shape, index }) {
      commit("addNewStop", { shape, index });
      dispatch("updateProject");
    },
    addShape(
      { commit, dispatch, getters },
      { layerName = getters.selectedLayer, shape = getters.shapeToBeAdded }
    ) {
      const shapeWithId = { ...shape, id: uuid() };
      commit("addShape", { layerName, shape: shapeWithId });
      commit("unsetShapeToBeAdded");
      dispatch("updateProject");
      return shapeWithId;
    },
    moveShape({ commit, dispatch }, { shape, left, top }) {
      commit("moveShape", { shape, left, top });
      dispatch("roundShapeProperties", { shape, left, top });
    },
    moveShapeBy({ commit, dispatch }, { shape, left, top }) {
      commit("moveShapeBy", { shape, left, top });
      dispatch("roundShapeProperties", { shape, left, top }).then(() => {
        dispatch("updateProject");
      });
    },
    removeSelectedShape({ dispatch, getters }) {
      Promise.all([
        dispatch("removeShape", getters.selectedShape),
        dispatch("unselectShape")
      ]).then(() => {
        dispatch("updateProject");
      });
    },
    removeShape({ commit, dispatch }, shape) {
      commit("removeShape", shape);
      dispatch("updateProject");
    },
    removeStop({ commit, dispatch }, { shape, index }) {
      commit("removeStop", { shape, index });
      dispatch("updateProject");
    },
    resizeShape(
      { commit, dispatch },
      { diff, direction, initialShapeProps, shape }
    ) {
      commit("resizeShape", { diff, direction, initialShapeProps, shape });
      dispatch("roundShapeProperties", { shape, ...initialShapeProps });
    },
    roundShapeProperties({ commit }, { shape, propertyNames, ...properties }) {
      if (propertyNames instanceof Array) {
        for (const propertyName of propertyNames) {
          commit("roundShapeProperty", { shape, propertyName });
        }
      }
      if (properties) {
        for (const key in properties) {
          if (properties[key] !== undefined) {
            commit("roundShapeProperty", { shape, propertyName: key });
          }
        }
      }
    },
    setShapes({ commit }, shapes) {
      commit("setShapes", shapes);
    },
    setShapeToBeAdded({ commit }, shape) {
      commit("setShapeToBeAdded", shape);
    },
    toggleLayer({ commit, dispatch }, layerName) {
      commit("toggleLayer", layerName);
      dispatch("updateProject");
    },
    updateShape({ commit, dispatch }, { shape, round = true, ...newProps }) {
      commit("updateShape", { shape, ...newProps });
      if (round) {
        dispatch("roundShapeProperties", {
          shape,
          propertyNames: ["left", "top"]
        }).then(() => dispatch("updateProject"));
      } else {
        dispatch("updateProject");
      }
    },
    updateShapeStop({ commit, dispatch }, { shape, stop, ...newProps }) {
      commit("updateShapeStop", { shape, stop, ...newProps });
      dispatch("updateProject");
    }
  }
};

function deepCopy(obj) {
  return JSON.parse(JSON.stringify(obj));
}

export default shapes;