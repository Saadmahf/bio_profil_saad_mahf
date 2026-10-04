# Saad Mahfoudi: EV engineering lab and portfolio

A static site for GitHub Pages: no build step and no backend. Every simulation runs in the browser.

```
index.html                     home: mini twin, career architectures, labs hub, vehicle map, skills, contact
projects/ev-twin.html          EV digital twin: PMSM + BMS integration, CAN, DC-bus FFT
projects/motor-lab.html        IPMSM lab: SPWM / SVPWM / six-step, DC-bus utilisation control, FOC speed loop
projects/hv-validation.html    HV validation method: acquisition, ripple/FFT, strategy comparison, C_link sizing, Bode
projects/can-lab.html          NGE: CAN / CAN FD encoder (ISO 11898-1), PIO TX/RX path, bit timing, PCB
projects/thermal.html          Heat exchanger: nonlinear model, state feedback, observer, Takagi–Sugeno
projects/power-lab.html        buck, rectifier, VSI, BMS PCB, IPMSM FOC (Simulink), ADAS
projects/bms.html              BMS supervisor (Stateflow chart + logged run replay)
projects/six-step.html         Six-step PMSM Simulink results (Kwon, Kim & Sul)
assets/js/lab/core.js          physics: IPMSM, MTPA/flux weakening, modulators, waveform synthesis, DC link, FFT
assets/js/lab/sim.js           powertrain + battery + BMS + VCU + drive cycles
assets/js/lab/ui.js            Scope, Spectrum, Arch (interactive diagrams), Car, Motor, Roll
assets/js/lab/mod.js           SPWM / SVPWM / six-step visualisers
assets/js/lab/can.js           CAN / CAN FD frame encoder
assets/js/lab/rig.js           shared manual/automatic control panel
assets/js/lab/page-*.js        page scripts
assets/data/                   data exported from the MATLAB projects and the thermal gains
```

All numbers in the simulations are illustrative engineering values. No OEM data or limits are used.

Live site: https://saadmahf.github.io/bio_profil_saad_mahf/
