import fs from 'node:fs';
import path from 'node:path';

const file = path.resolve('src/main.jsx');
let source = fs.readFileSync(file, 'utf8');

// ErrandGo is global: display task budgets using the task's stored currency
// instead of hard-coding every price to Nigerian naira.
const oldMoney = "const money=n=>new Intl.NumberFormat('en-NG',{style:'currency',currency:'NGN',maximumFractionDigits:0}).format(Number(n)||0);";
const newMoney = "const money=(n,currency='NGN')=>{const c=String(currency||'NGN').toUpperCase();const localeMap={NGN:'en-NG',USD:'en-US',GBP:'en-GB',EUR:'de-DE',CAD:'en-CA',AUD:'en-AU',ZAR:'en-ZA',GHS:'en-GH',KES:'en-KE',AED:'en-AE',INR:'en-IN'};return new Intl.NumberFormat(localeMap[c]||undefined,{style:'currency',currency:c,maximumFractionDigits:0}).format(Number(n)||0)};";
if (source.includes(oldMoney)) source = source.replace(oldMoney, newMoney);
source = source.replace('price:money(e.budget),', 'price:money(e.budget,e.currency),');

fs.writeFileSync(file, source);
console.log('[ErrandGo] production build preparation complete');
