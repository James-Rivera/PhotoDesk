"use client";

import { createContext, useContext } from "react";

const BranchLocalContext = createContext(false);

export function DeploymentModeProvider({ branchLocal, children }: { branchLocal: boolean; children: React.ReactNode }) {
  return <BranchLocalContext.Provider value={branchLocal}>{children}</BranchLocalContext.Provider>;
}

export function useBranchLocalMode() {
  return useContext(BranchLocalContext);
}
