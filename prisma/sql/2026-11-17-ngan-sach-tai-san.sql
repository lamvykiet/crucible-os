-- AlterTable
ALTER TABLE "Budget" ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "kind" TEXT NOT NULL DEFAULT 'expense',
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateTable
CREATE TABLE "NetWorthSnapshot" (
    "id" TEXT NOT NULL,
    "month" TEXT NOT NULL,
    "assets" BIGINT NOT NULL,
    "debts" BIGINT NOT NULL,
    "cash" BIGINT NOT NULL,
    "netWorth" BIGINT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'computed',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "NetWorthSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "NetWorthSnapshot_userId_month_key" ON "NetWorthSnapshot"("userId", "month");

-- CreateIndex
CREATE UNIQUE INDEX "Budget_userId_periodType_period_kind_categoryGroup_key" ON "Budget"("userId", "periodType", "period", "kind", "categoryGroup");

-- AddForeignKey
ALTER TABLE "NetWorthSnapshot" ADD CONSTRAINT "NetWorthSnapshot_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

