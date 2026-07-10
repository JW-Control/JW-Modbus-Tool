// @ts-nocheck
export {};

const styleId = "jw-simple-tests-layout-guard-style";

if (!document.getElementById(styleId)) {
  const style = document.createElement("style");
  style.id = styleId;
  style.textContent = `
#jw-simple-tests-runtime-overlay .testsRuntime{
  grid-template-columns:minmax(0,1fr) 318px!important;
  grid-template-rows:minmax(360px,clamp(360px,36vh,392px)) 104px minmax(0,1fr)!important;
  gap:12px!important;
}
#jw-simple-tests-runtime-overlay .testsRuntime .plan,
#jw-simple-tests-runtime-overlay .testsRuntime .scenarios{
  align-self:stretch!important;
  height:100%!important;
}
#jw-simple-tests-runtime-overlay .testsRuntime .plan{
  display:flex!important;
  flex-direction:column!important;
  overflow:hidden!important;
}
#jw-simple-tests-runtime-overlay .testsRuntime .planBody{
  flex:1 1 auto!important;
  min-height:0!important;
  max-height:none!important;
  overflow:auto!important;
}
#jw-simple-tests-runtime-overlay .testsRuntime .infoLine{
  flex:0 0 auto!important;
}
#jw-simple-tests-runtime-overlay .testsRuntime .testkpis{
  min-height:0!important;
  align-self:stretch!important;
}
#jw-simple-tests-runtime-overlay .testsRuntime .kpiCard{
  height:100%!important;
  box-sizing:border-box!important;
  display:flex!important;
  align-items:center!important;
  justify-content:flex-start!important;
  gap:18px!important;
  padding:14px 18px!important;
}
#jw-simple-tests-runtime-overlay .testsRuntime .ringKpi .ring{
  width:78px!important;
  height:78px!important;
  min-width:78px!important;
  flex:0 0 78px!important;
  margin-left:4px!important;
}
#jw-simple-tests-runtime-overlay .testsRuntime .kpiCopy{
  min-width:0!important;
  display:flex!important;
  flex-direction:column!important;
  justify-content:center!important;
  gap:4px!important;
}
#jw-simple-tests-runtime-overlay .testsRuntime .textKpi .kpiValue{
  font-size:2rem!important;
  line-height:1!important;
}
@media (max-height: 900px){
  #jw-simple-tests-runtime-overlay .testsRuntime{
    grid-template-rows:minmax(330px,360px) 96px minmax(0,1fr)!important;
  }
  #jw-simple-tests-runtime-overlay .testsRuntime .ringKpi .ring{
    width:70px!important;
    height:70px!important;
    min-width:70px!important;
    flex-basis:70px!important;
  }
}
`;
  document.head.appendChild(style);
}
