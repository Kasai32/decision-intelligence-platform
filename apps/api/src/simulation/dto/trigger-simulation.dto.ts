import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';
import { SimulationScenario } from '../simulation-scenario.service';

export const SIMULATION_SCENARIOS: SimulationScenario[] = [
  'CYBER_RANSOMWARE',
  'CLOUD_OUTAGE_PARTIAL_EVIDENCE',
];

export class TriggerSimulationDto {
  @ApiProperty({ enum: SIMULATION_SCENARIOS })
  @IsIn(SIMULATION_SCENARIOS)
  scenario!: SimulationScenario;
}
