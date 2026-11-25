import type { GreenroomApi } from "@shared/api";

declare global {
  interface Window {
    greenroom: GreenroomApi;
  }
}
