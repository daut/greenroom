import type { TrainingDefinition } from "../training";
import { englishTraining } from "./english";
import { interviewTraining } from "./interview";
import { presentationTraining } from "./presentation";

/** Every training the app offers. Add new ones here. */
export const TRAININGS: TrainingDefinition[] = [
  interviewTraining,
  presentationTraining,
  englishTraining,
];

export function trainingById(id: string): TrainingDefinition | undefined {
  return TRAININGS.find((t) => t.id === id);
}
