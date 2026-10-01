import { MachineConfig, MachineId } from '../types/factory';

export const MACHINES_CONFIG: Record<MachineId, MachineConfig> = {
  cut_01: {
    id: 'cut_01',
    name: 'Cutting Machine',
    type: 'Hydraulic High-Speed Shear',
    position: 1,
    installDate: '2023-01-15',
    criticality: 'HIGH',
    nominal: { temp: 52.0, vib: 1.8, current: 18.5, pressure: 8.2, rpm: 1200, power: 14.5, cycle: 3.8 },
    tolerances: { tempMax: 85.0, vibMax: 5.5, currentMax: 30.0, pressureMin: 5.0 }
  },
  cnc_01: {
    id: 'cnc_01',
    name: 'CNC Milling',
    type: '5-Axis Precision Spindle',
    position: 2,
    installDate: '2022-11-20',
    criticality: 'CRITICAL',
    nominal: { temp: 64.0, vib: 2.1, current: 24.0, pressure: 6.5, rpm: 4800, power: 22.0, cycle: 8.5 },
    tolerances: { tempMax: 90.0, vibMax: 6.0, currentMax: 40.0, pressureMin: 4.8 }
  },
  weld_01: {
    id: 'weld_01',
    name: 'Welding Robot',
    type: '6-DOF Articulated MIG Arm',
    position: 3,
    installDate: '2023-05-10',
    criticality: 'HIGH',
    nominal: { temp: 58.0, vib: 1.4, current: 15.0, pressure: 7.0, rpm: 900, power: 18.0, cycle: 5.2 },
    tolerances: { tempMax: 88.0, vibMax: 4.5, currentMax: 28.0, pressureMin: 5.2 }
  },
  paint_01: {
    id: 'paint_01',
    name: 'Painting Booth',
    type: 'Electrostatic Chamber',
    position: 4,
    installDate: '2022-08-01',
    criticality: 'MEDIUM',
    nominal: { temp: 45.0, vib: 0.9, current: 12.0, pressure: 5.8, rpm: 750, power: 9.5, cycle: 12.0 },
    tolerances: { tempMax: 75.0, vibMax: 3.5, currentMax: 20.0, pressureMin: 4.0 }
  },
  pack_01: {
    id: 'pack_01',
    name: 'Packaging Unit',
    type: 'Cartoner & Strapping Cell',
    position: 5,
    installDate: '2023-09-12',
    criticality: 'MEDIUM',
    nominal: { temp: 42.0, vib: 1.2, current: 9.5, pressure: 6.0, rpm: 1100, power: 7.2, cycle: 2.5 },
    tolerances: { tempMax: 70.0, vibMax: 4.0, currentMax: 18.0, pressureMin: 4.5 }
  }
};

export const FAILURE_DESCRIPTIONS: Record<string, { label: string; desc: string; targetMachines: MachineId[] }> = {
  bearing_wear: {
    label: 'Bearing Wear',
    desc: 'Spindle friction creates progressive vibration (mm/s) and heat buildup.',
    targetMachines: ['cnc_01', 'cut_01', 'pack_01']
  },
  overheating: {
    label: 'Cooling / Radiator Failure',
    desc: 'Thermal dissipation failure causes rapid temperature climb and auxiliary draw.',
    targetMachines: ['paint_01', 'cnc_01', 'weld_01']
  },
  motor_overload: {
    label: 'Motor Overload & Binding',
    desc: 'Mechanical resistance induces high current spikes (A) and RPM droop.',
    targetMachines: ['cut_01', 'cnc_01', 'pack_01']
  },
  hydraulic_leak: {
    label: 'Pneumatic / Hydraulic Leak',
    desc: 'Pressure decay drops clamping force, causing cycle time to elongate.',
    targetMachines: ['weld_01', 'cut_01', 'paint_01']
  },
  tool_wear: {
    label: 'Tool Edge Blunting',
    desc: 'Micro-chatter increases product surface defects and reject rate.',
    targetMachines: ['cnc_01', 'cut_01']
  },
  sudden_electrical: {
    label: 'Sudden Electrical Disconnect',
    desc: 'Unannounced 10% random trip with instantaneous zero spindle speed.',
    targetMachines: ['cut_01', 'cnc_01', 'weld_01', 'paint_01', 'pack_01']
  }
};
