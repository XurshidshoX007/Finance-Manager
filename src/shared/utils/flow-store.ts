// ============================================
// SHARED FLOW STORE
// Foydalanuvchilarning faol jarayonlari (tranzaksiya/manba yaratish va h.k.)
// Bir foydalanuvchida birdaniga faqat bitta faol jarayon bo'lishi mumkin.
// ============================================

export interface TransactionFlowState {
  kind: "transaction";
  type: "INCOME" | "EXPENSE" | "TRANSFER";
  step: "amount" | "category" | "source" | "target" | "description";
  amount?: string;
  categoryId?: string;
  sourceId?: string;
  transferSourceId?: string;
  transferTargetId?: string;
}

export interface SourceFlowState {
  kind: "source";
  creatingSource: boolean;
}

export type UserFlow = TransactionFlowState | SourceFlowState;

const flows = new Map<string, UserFlow>();

export const flowStore = {
  get(userId: string): UserFlow | undefined {
    return flows.get(userId);
  },
  set(userId: string, flow: UserFlow): void {
    flows.set(userId, flow);
  },
  delete(userId: string): boolean {
    return flows.delete(userId);
  },
  has(userId: string): boolean {
    return flows.has(userId);
  },
};
