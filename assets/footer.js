if(!customElements.get("footer-details")){class FooterDetails extends AccordionDetails{constructor(){super()}
connectedCallback(){this.openDefault=this.dataset.openDefault==='true';if(FoxTheme.config.mqlTablet){if(!this.openDefault)this.open=!1}
document.addEventListener('matchTablet',()=>{if(!this.openDefault){this.open=!1}else{this.open=!0}});document.addEventListener('unmatchTablet',()=>{this.open=!0})}}
customElements.define('footer-details',FooterDetails,{extends:'details'})}