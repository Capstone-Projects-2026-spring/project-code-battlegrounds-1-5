import React from 'react';
import Figure from "../../components/Figure";
import InlineDocs from "../../components/InlineDocs";
import Contributors from "../../components/Contributors";
import dinosaur from "/static/img/docusaurus.png"
// Add react-live imports you need here
const ReactLiveScope = {
  React,
  ...React,
  Figure,
  InlineDocs,
  Contributors,
  dinosaur

};
export default ReactLiveScope;
