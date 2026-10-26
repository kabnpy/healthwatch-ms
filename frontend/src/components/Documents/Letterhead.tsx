export function Letterhead() {
  return (
    <div className="flex justify-between items-end mb-12 border-b-4 border-black pb-6">
      <div className="flex flex-col items-start">
        <h1 className="font-black text-3xl uppercase tracking-tighter mb-1 leading-none">
          HealthWatch MS
        </h1>
        <p className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted-foreground">
          Insurance Agency Operations &bull; Nairobi, Kenya
        </p>
      </div>
      <div className="text-[10px] font-medium space-y-0.5 text-right text-slate-600 leading-tight uppercase tracking-wider">
        <p>Hughes Building, 4th Floor, Kenyatta Avenue</p>
        <p>P.O. Box 45123 - 00100 Nairobi | Tel: +254 (0) 20 2212345</p>
        <p className="font-bold text-black font-mono">
          KRA PIN: P051234567Z &bull; IRA: IRA/05/2048/2026
        </p>
      </div>
    </div>
  )
}
