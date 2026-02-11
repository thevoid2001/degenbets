use anchor_lang::prelude::*;
use crate::errors::DegenBetsError;

/// Integer square root via Newton's method for u128.
pub fn isqrt(n: u128) -> u128 {
    if n == 0 {
        return 0;
    }
    let mut x = n;
    let mut y = (x + 1) / 2;
    while y < x {
        x = y;
        y = (x + n / x) / 2;
    }
    x
}

/// Calculate shares received when buying on one side.
///
/// Mechanism: mint `sol_amount` complete sets, then swap the unwanted side
/// through the CPMM to get more of the wanted side.
///
/// For buying YES:
///   - Mint: sol_amount YES + sol_amount NO
///   - Swap sol_amount NO into pool -> get YES out
///   - User receives: sol_amount + yes_out
///
/// Returns (shares_out, new_yes_reserve, new_no_reserve)
pub fn calc_buy_yes(
    sol_amount: u64,
    yes_reserve: u64,
    no_reserve: u64,
    swap_fee_bps: u16,
) -> Result<(u64, u64, u64)> {
    let sol = sol_amount as u128;
    let ry = yes_reserve as u128;
    let rn = no_reserve as u128;
    let fee_denom = 10000u128;
    let fee_num = swap_fee_bps as u128;

    // After minting, swap sol_amount NO into pool
    let new_rn = rn.checked_add(sol).ok_or(DegenBetsError::MathOverflow)?;

    // Constant product: yes_out_raw = ry - (ry * rn) / new_rn
    let k = ry.checked_mul(rn).ok_or(DegenBetsError::MathOverflow)?;
    let ry_after_swap = k.checked_div(new_rn).ok_or(DegenBetsError::MathOverflow)?;
    let yes_out_raw = ry.checked_sub(ry_after_swap).ok_or(DegenBetsError::MathOverflow)?;

    // Fee on swap output stays in pool
    let fee = yes_out_raw
        .checked_mul(fee_num)
        .ok_or(DegenBetsError::MathOverflow)?
        .checked_div(fee_denom)
        .ok_or(DegenBetsError::MathOverflow)?;
    let yes_out = yes_out_raw.checked_sub(fee).ok_or(DegenBetsError::MathOverflow)?;

    // New reserves: yes_reserve loses yes_out (fee portion stays)
    let new_ry = ry.checked_sub(yes_out).ok_or(DegenBetsError::MathOverflow)?;

    // Total shares user receives = minted + swapped
    let total_shares = sol.checked_add(yes_out).ok_or(DegenBetsError::MathOverflow)?;

    Ok((total_shares as u64, new_ry as u64, new_rn as u64))
}

/// Mirror of calc_buy_yes but for buying NO.
pub fn calc_buy_no(
    sol_amount: u64,
    yes_reserve: u64,
    no_reserve: u64,
    swap_fee_bps: u16,
) -> Result<(u64, u64, u64)> {
    // Symmetric: swap YES into pool, get NO out
    let (shares, new_no, new_yes) = calc_buy_yes(sol_amount, no_reserve, yes_reserve, swap_fee_bps)?;
    Ok((shares, new_yes, new_no))
}

/// Calculate SOL received when selling shares on one side.
///
/// Mechanism: swap some shares into pool to get the opposite side,
/// then burn matched pairs as complete sets for SOL.
///
/// Solves quadratic: A^2 + A*(Ry + Rn - S) - S*Ry = 0
/// where A = amount to swap, S = shares to sell, Ry/Rn = reserves.
///
/// Returns (sol_out, new_yes_reserve, new_no_reserve)
pub fn calc_sell_yes(
    shares: u64,
    yes_reserve: u64,
    no_reserve: u64,
    swap_fee_bps: u16,
) -> Result<(u64, u64, u64)> {
    require!(shares > 0, DegenBetsError::ZeroBetAmount);

    let s = shares as u128;
    let ry = yes_reserve as u128;
    let rn = no_reserve as u128;

    // For the fee-adjusted version, we use effective reserves
    // The swap gives: B = Rn * A_eff / (Ry + A_eff) where A_eff = A * (10000 - fee) / 10000
    // We want S - A = B for clean exit
    // This leads to a more complex quadratic; for simplicity we solve without fee
    // and apply fee to the final SOL output.

    // No-fee quadratic: A^2 + A*(Ry + Rn - S) - S*Ry = 0
    // discriminant = (Ry + Rn - S)^2 + 4*S*Ry = (Ry + Rn + S)^2 - 4*S*Rn
    let sum = ry + rn + s;
    let disc = sum
        .checked_mul(sum)
        .ok_or(DegenBetsError::MathOverflow)?
        .checked_sub(
            4u128
                .checked_mul(s)
                .ok_or(DegenBetsError::MathOverflow)?
                .checked_mul(rn)
                .ok_or(DegenBetsError::MathOverflow)?,
        )
        .ok_or(DegenBetsError::MathOverflow)?;

    let sqrt_disc = isqrt(disc);

    // A = (S - Ry - Rn + sqrt(disc)) / 2
    // Note: S - Ry - Rn could be negative, so work with signed logic via u128
    // Rewrite: A = (sqrt(disc) - (Ry + Rn - S)) / 2
    let ry_rn = ry + rn;
    let a = if s >= ry_rn {
        // S >= Ry + Rn: both terms positive
        let numerator = (s - ry_rn) + sqrt_disc;
        numerator / 2
    } else {
        // S < Ry + Rn: need sqrt(disc) > (Ry + Rn - S)
        let deficit = ry_rn - s;
        require!(sqrt_disc >= deficit, DegenBetsError::MathOverflow);
        (sqrt_disc - deficit) / 2
    };

    // SOL out (before fee) = complete sets burned = S - A
    let sol_before_fee = s.checked_sub(a).ok_or(DegenBetsError::MathOverflow)?;

    // Apply swap fee to the output
    let fee = sol_before_fee
        .checked_mul(swap_fee_bps as u128)
        .ok_or(DegenBetsError::MathOverflow)?
        .checked_div(10000u128)
        .ok_or(DegenBetsError::MathOverflow)?;
    let sol_out = sol_before_fee.checked_sub(fee).ok_or(DegenBetsError::MathOverflow)?;

    // Update reserves: user swaps A YES into pool, gets (S - A) NO from pool
    let new_ry = ry.checked_add(a).ok_or(DegenBetsError::MathOverflow)?;
    let b = s.checked_sub(a).ok_or(DegenBetsError::MathOverflow)?;
    let new_rn = rn.checked_sub(b).ok_or(DegenBetsError::MathOverflow)?;

    // total_minted decreases by sol_before_fee (complete sets burned, fee stays in vault)
    // But the fee portion stays in the pool by NOT being paid out
    // The caller handles total_minted -= sol_out and vault -= sol_out

    Ok((sol_out as u64, new_ry as u64, new_rn as u64))
}

/// Mirror of calc_sell_yes but for selling NO.
pub fn calc_sell_no(
    shares: u64,
    yes_reserve: u64,
    no_reserve: u64,
    swap_fee_bps: u16,
) -> Result<(u64, u64, u64)> {
    let (sol_out, new_no, new_yes) = calc_sell_yes(shares, no_reserve, yes_reserve, swap_fee_bps)?;
    Ok((sol_out, new_yes, new_no))
}

/// Calculate price as basis points (0-10000) for events.
/// price_yes = no_reserve / (yes_reserve + no_reserve) * 10000
pub fn price_yes_bps(yes_reserve: u64, no_reserve: u64) -> u64 {
    let ry = yes_reserve as u128;
    let rn = no_reserve as u128;
    let total = ry + rn;
    if total == 0 {
        return 5000; // 50%
    }
    (rn * 10000 / total) as u64
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_isqrt() {
        assert_eq!(isqrt(0), 0);
        assert_eq!(isqrt(1), 1);
        assert_eq!(isqrt(4), 2);
        assert_eq!(isqrt(9), 3);
        assert_eq!(isqrt(10), 3);
        assert_eq!(isqrt(100), 10);
        assert_eq!(isqrt(u128::MAX), 18446744073709551615);
    }

    #[test]
    fn test_buy_sell_roundtrip() {
        // Pool: 1 SOL each side (1e9 lamports)
        let ry = 1_000_000_000u64;
        let rn = 1_000_000_000u64;
        let fee = 30u16; // 0.3%

        // Buy 0.1 SOL of YES
        let (shares, new_ry, new_rn) = calc_buy_yes(100_000_000, ry, rn, fee).unwrap();
        assert!(shares > 100_000_000); // should get more than 0.1 SOL worth
        assert!(new_ry < ry); // YES reserve decreased
        assert!(new_rn > rn); // NO reserve increased

        // Sell those shares back
        let (sol_back, _, _) = calc_sell_yes(shares, new_ry, new_rn, fee).unwrap();
        // Should get back less than we put in (fees)
        assert!(sol_back < 100_000_000);
        // But not too much less (should lose ~0.6% from two swaps)
        assert!(sol_back > 99_000_000);
    }

    #[test]
    fn test_price_after_buy() {
        let ry = 1_000_000_000u64;
        let rn = 1_000_000_000u64;

        // Initial price should be 50%
        assert_eq!(price_yes_bps(ry, rn), 5000);

        // After buying YES, price should increase
        let (_, new_ry, new_rn) = calc_buy_yes(500_000_000, ry, rn, 30).unwrap();
        let price = price_yes_bps(new_ry, new_rn);
        assert!(price > 5000);
    }
}
