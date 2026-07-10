// @ts-nocheck
export {};

const styleId = "jw-simple-tests-base-layout-fix-style";

if (!document.getElementById(styleId)) {
  const style = document.createElement("style");
  style.id = styleId;
  style.textContent = `
/*
  Fallback visual para la vista React base de Pruebas.
  Esta regla evita que, si el runtime overlay no monta, la pantalla vuelva al layout alto/antiguo.
*/
.workspace > .tests{
  height:100%!important;
  min-height:0!important;
  overflow:hidden!important;
  display:grid!important;
  grid-template-columns:minmax(0,1fr) 318px!important;
  grid-template-rows:minmax(330px,390px) 104px minmax(0,1fr)!important;
  gap:12px!important;
  align-items:stretch!important;
}
.workspace > .tests .card{
  min-height:0!important;
  overflow:hidden!important;
}
.workspace > .tests .plan{
  grid-column:1!important;
  grid-row:1!important;
  display:flex!important;
  flex-direction:column!important;
  height:100%!important;
}
.workspace > .tests .plan > header{
  flex:0 0 auto!important;
  margin-bottom:8px!important;
}
.workspace > .tests .plan .tableactions{
  flex:0 0 auto!important;
  margin-bottom:8px!important;
}
.workspace > .tests .plan .table{
  flex:1 1 auto!important;
  min-height:0!important;
  max-height:none!important;
  overflow:auto!important;
}
.workspace > .tests .scenarios{
  grid-column:2!important;
  grid-row:1!important;
  height:100%!important;
  overflow:hidden!important;
}
.workspace > .tests .scenarios > div,
.workspace > .tests .scenarios .scenarioList{
  min-height:0!important;
  overflow:auto!important;
  scrollbar-width:thin;
  scrollbar-color:#2d87aa #071d30;
}
.workspace > .tests .sim{
  grid-column:2!important;
  grid-row:2 / 4!important;
  height:100%!important;
  overflow:hidden!important;
}
.workspace > .tests .testkpis{
  grid-column:1!important;
  grid-row:2!important;
  min-height:0!important;
  display:grid!important;
  grid-template-columns:repeat(4,minmax(0,1fr))!important;
  gap:8px!important;
}
.workspace > .tests .testkpis .big{
  height:100%!important;
  min-height:0!important;
  display:flex!important;
  align-items:center!important;
  justify-content:flex-start!important;
  gap:18px!important;
  padding:12px 16px!important;
}
.workspace > .tests .testkpis .big strong{
  margin:0!important;
  min-width:74px!important;
  min-height:74px!important;
  width:74px!important;
  height:74px!important;
  border-radius:50%!important;
  display:grid!important;
  place-items:center!important;
  background:conic-gradient(#5ce044 100%,#0b3952 0)!important;
  color:#eef7ff!important;
  font-size:1.25rem!important;
  flex:0 0 74px!important;
  box-shadow:inset 0 0 0 13px #062033!important;
}
.workspace > .tests .testkpis .big:nth-child(2) strong,
.workspace > .tests .testkpis .big:nth-child(3) strong{
  width:auto!important;
  height:auto!important;
  min-width:0!important;
  min-height:0!important;
  border-radius:0!important;
  box-shadow:none!important;
  background:transparent!important;
  color:#00d5ff!important;
  display:block!important;
  font-size:2rem!important;
  flex:0 0 auto!important;
}
.workspace > .tests .testkpis .big.danger strong,
.workspace > .tests .testkpis .big:nth-child(3) strong{
  color:#ff5d5d!important;
}
.workspace > .tests .exec{
  grid-column:1 / 3!important;
  grid-row:3!important;
  min-height:0!important;
  display:flex!important;
  flex-direction:column!important;
  overflow:hidden!important;
}
.workspace > .tests .exec .table{
  flex:1 1 auto!important;
  min-height:0!important;
  overflow:auto!important;
}
@media (max-height:900px){
  .workspace > .tests{
    grid-template-rows:minmax(300px,350px) 96px minmax(0,1fr)!important;
  }
  .workspace > .tests .testkpis .big strong{
    width:68px!important;
    height:68px!important;
    min-width:68px!important;
    min-height:68px!important;
    flex-basis:68px!important;
  }
}
`;
  document.head.appendChild(style);
}
