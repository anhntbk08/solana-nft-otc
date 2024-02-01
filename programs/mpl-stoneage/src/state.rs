//! Module provide program defined state

use crate::utils::{DESCRIPTION_DEFAULT_SIZE, NAME_DEFAULT_SIZE};
use anchor_lang::prelude::*;
use mpl_token_metadata::state::Creator as MPL_Creator;
use std::convert::From;

// by system acc I mean account to hold only native SOL
pub const MINIMUM_BALANCE_FOR_SYSTEM_ACCS: u64 = 890880;

#[account]
pub struct Store {
    pub admin: Pubkey,
    pub name: String,
    pub description: String,
}

impl Store {
    pub const LEN: usize = 8 + 32 + NAME_DEFAULT_SIZE + DESCRIPTION_DEFAULT_SIZE;
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug, PartialEq, Eq)]
pub enum MarketState {
    Uninitialized,
    Created,
    Suspended,
    Active,
    Ended,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug, PartialEq, Eq)]
pub enum MarketType {
    SingleVsSingle,
    MultipleVsSingle,
    MultipleVsMultiple,
}

#[account]
pub struct Market {
    // allowed mint tokens
    pub allowed_tokens: Vec<Pubkey>,

    // owner token accounts to receive swap result
    pub receiver_token_accounts: Vec<Pubkey>,

    //allowed users to do the swap 
    pub appointed_wallets: Vec<Pubkey>,

    // store this market belongs to
    pub store: Pubkey,

    // mint token that market selling
    pub resource: Pubkey,

    // token account that hold selling token
    pub vault: Pubkey,

    pub vault_owner: Pubkey,

    // market owner
    pub admin: Pubkey,

    pub name: String,
    pub description: String,

    // is allow to change/suspend market
    pub mutable: bool,
    pub start_date: u64,
    pub end_date: Option<u64>,
    pub state: MarketState,
    pub market_type: MarketType,
    pub gatekeeper: Option<GatingConfig>,
}

#[derive(AnchorDeserialize, AnchorSerialize, Clone, Debug, PartialEq, Eq)]
pub struct GatingConfig {
    pub collection: Pubkey,
    /// whether program will burn token or just check availability
    pub expire_on_use: bool,
    pub gating_time: Option<u64>,
}

pub fn from_mpl_creators(creators: Vec<mpl_token_metadata::state::Creator>) -> Vec<Creator> {
    creators
        .iter()
        .map(|e| Creator {
            address: e.address,
            share: e.share,
            verified: e.verified,
        })
        .collect()
}

// Unfortunate duplication of token metadata so that IDL picks it up.
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct Creator {
    pub address: Pubkey,
    pub verified: bool,
    // In percentages, NOT basis points ;) Watch out!
    pub share: u8,
}

impl From<MPL_Creator> for Creator {
    fn from(item: MPL_Creator) -> Self {
        Creator {
            address: item.address,
            verified: item.verified,
            share: item.share,
        }
    }
}
