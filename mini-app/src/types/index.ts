export interface Source {
  id: string;
  name: string;
  emoji: string;
  color: string;
  currency: string;
  description: string | null;
  isSystem: boolean;
  balance: { income: number; expense: number; net: number };
  createdAt: string;
  updatedAt: string;
}

export interface Category {
  id: string;
  name: string;
  emoji: string;
  color: string;
  type: "INCOME" | "EXPENSE";
  description: string | null;
  groupId: string | null;
  groupName: string | null;
  isSystem: boolean;
  stats: { total: number; count: number };
}

export interface Transaction {
  id: string;
  type: "INCOME" | "EXPENSE" | "TRANSFER";
  amount: string;
  currency: string;
  description: string | null;
  referenceId: string | null;
  isCancelled: boolean;
  cancelledAt: string | null;
  cancelReason: string | null;
  transactionDate: string;
  createdAt: string;
  updatedAt: string;
  category: { id: string; name: string; emoji: string } | null;
  source: { id: string; name: string; emoji: string } | null;
  transferSource: { id: string; name: string; emoji: string } | null;
  transferTarget: { id: string; name: string; emoji: string } | null;
}

export interface Credit {
  id: string;
  name: string;
  totalAmount: string;
  remainingDebt: string;
  monthlyPayment: string;
  interestRate: string;
  termMonths: number;
  paidMonths: number;
  type: "ANNUITY" | "DIFFERENTIAL";
  status: "ACTIVE" | "COMPLETED" | "CANCELLED";
  startDate: string;
  endDate: string;
  source: { id: string; name: string; emoji: string } | null;
  scheduleCount: number;
  paidScheduleCount: number;
}

export interface Dashboard {
  totalBalance: Record<string, { income: number; expense: number; net: number }>;
  todayIncome: number;
  todayExpense: number;
  monthlyIncome: number;
  monthlyExpense: number;
  activeCredits: number;
  totalRemainingDebt: string;
  topExpenseCategories: Array<{ id: string; name: string; emoji: string; total: number }>;
  topIncomeCategories: Array<{ id: string; name: string; emoji: string; total: number }>;
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export interface Kpi {
  savingsRate: number;
  incomeGrowth: number;
  expenseGrowth: number;
  netWorth: number;
  debtToIncomeRatio: number;
}
