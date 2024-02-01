pub mod error;
pub mod processor;
pub mod state;
pub mod utils;

use crate::{
    error::ErrorCode,
    state::{
        Market,
        Store,
    },
    utils::*,
};
use anchor_lang::{prelude::*, system_program::System, AnchorDeserialize, AnchorSerialize};
use anchor_spl::{
    token::{Token, TokenAccount},
};

declare_id!("DqCxZNXbsiU9NN7RBTMLZ5mu1YJaK33ua44ik7amP2Cf");

#[program]
pub mod mpl_stoneage {
    use super::*;

    pub fn create_store<'info>(
        ctx: Context<'_, '_, '_, 'info, CreateStore<'info>>,
        name: String,
        description: String,
    ) -> Result<()> {
        ctx.accounts.process(name, description)
    }

    pub fn buy<'info>(
        ctx: Context<'_, '_, '_, 'info, Buy<'info>>,
        vault_owner_bump: u8,
    ) -> Result<()> {
        ctx.accounts.process(
            vault_owner_bump,
        )
    }

    pub fn close_market<'info>(
        ctx: Context<'_, '_, '_, 'info, CloseMarket<'info>>,
        vault_owner_bump: u8,
    ) -> Result<()> {
        ctx.accounts.process(vault_owner_bump)
    }

    pub fn suspend_market<'info>(
        ctx: Context<'_, '_, '_, 'info, SuspendMarket<'info>>,
    ) -> Result<()> {
        ctx.accounts.process()
    }

    pub fn change_market<'info>(
        ctx: Context<'_, '_, '_, 'info, ChangeMarket<'info>>,
        new_name: Option<String>,
        new_description: Option<String>,
        mutable: Option<bool>,
    ) -> Result<()> {
        ctx.accounts.process(
            new_name,
            new_description,
            mutable,
        )
    }

    pub fn resume_market<'info>(
        ctx: Context<'_, '_, '_, 'info, ResumeMarket<'info>>,
    ) -> Result<()> {
        ctx.accounts.process()
    }

    pub fn create_market<'info>(
        ctx: Context<'_, '_, '_, 'info, CreateMarket<'info>>,
        vault_owner_bump: u8,
        name: String,
        description: String,
        mutable: bool,
        allowed_tokens: Vec<Pubkey>,
        receiver_token_accounts: Vec<Pubkey>,
        appointed_wallets: Vec<Pubkey>,
        start_date: u64,
        end_date: Option<u64>,
    ) -> Result<()> {
        ctx.accounts.process(
            name,
            description,
            mutable,
            allowed_tokens,
            receiver_token_accounts,
            appointed_wallets,
            start_date,
            end_date,
        )
    }
}

#[derive(Accounts)]
#[instruction(name: String, description: String)]
pub struct CreateStore<'info> {
    #[account(mut)]
    admin: Signer<'info>,
    #[account(init, space=Store::LEN, payer=admin)]
    store: Box<Account<'info, Store>>,
    system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(vault_owner_bump: u8, name: String, description: String, mutable: bool, allowed_tokens: Vec<Pubkey>, receiver_token_accounts: Vec<Pubkey>, appointed_wallets: Vec<Pubkey>,  start_date: u64, end_date: Option<u64>)]
pub struct CreateMarket<'info> {
    #[account(zero)]
    market: Box<Account<'info, Market>>,

    #[account(has_one=admin)]
    store: Box<Account<'info, Store>>,

    #[account(mut)]
    admin: Signer<'info>,

    #[account(mut)]
    /// CHECK: checked in program
    resource_token: UncheckedAccount<'info>,

    #[account(owner=mpl_token_metadata::id())]
    /// CHECK: checked in program
    master_edition: UncheckedAccount<'info>,

    #[account(owner=mpl_token_metadata::id())]
    /// CHECK: checked in program
    metadata: UncheckedAccount<'info>,

    #[account(mut, has_one=owner)]
    vault: Box<Account<'info, TokenAccount>>,

    /// CHECK: checked in program
    mint: UncheckedAccount<'info>,

    #[account(seeds=[VAULT_OWNER_PREFIX.as_bytes(), mint.key().as_ref(), store.key().as_ref()], bump=vault_owner_bump)]
    /// CHECK: checked in program
    /// Vault Owner
    owner: UncheckedAccount<'info>,
    token_program: Program<'info, Token>,
    system_program: Program<'info, System>,
    // if gating config is set collection mint key should be passed
    // collection_mint: Account<'info, Mint>
}

#[derive(Accounts)]
#[instruction(vault_owner_bump: u8)]
pub struct Buy<'info> {
    // #[account(mut, has_one=treasury_holder, has_one=selling_resource)]
    #[account(mut)]
    market: Box<Account<'info, Market>>,

    #[account(mut)]
    buyer_wallet: Signer<'info>,

    #[account(mut)]
    // this account for storing exchange token
    /// CHECK: checked in program
    buyer_exchange_token_account: UncheckedAccount<'info>,

    /// CHECK: checked in program
    buyer_exchange_resource_mint: UncheckedAccount<'info>,

    #[account(mut)]
    // /// CHECK: checked in program
    buyer_receiver_token_account: Box<Account<'info, TokenAccount>>,

    #[account(mut)]
    /// CHECK: checked in program
    vault_token_account: Box<Account<'info, TokenAccount>>,

    #[account(mut)]
    /// CHECK: checked in program
    treasury_holder: UncheckedAccount<'info>,

    #[account(mut, owner=mpl_token_metadata::id())]
    /// CHECK: checked in program
    master_edition: UncheckedAccount<'info>,

    #[account(owner=mpl_token_metadata::id())]
    /// CHECK: checked in program
    metadata: UncheckedAccount<'info>,

    #[account(mut, has_one=owner)]
    vault: Box<Account<'info, TokenAccount>>,
    
    #[account(seeds=[VAULT_OWNER_PREFIX.as_bytes(), market.resource.as_ref(), market.store.as_ref()], bump=vault_owner_bump)]
    /// CHECK: checked in program
    /// vault owner
    owner: UncheckedAccount<'info>,

    /// CHECK: checked in program
    admin: UncheckedAccount<'info>,

    clock: Sysvar<'info, Clock>,
    rent: Sysvar<'info, Rent>,
    /// CHECK: checked in program
    token_metadata_program: UncheckedAccount<'info>,
    // token_program: Program<'info, Token>,
    /// CHECK: checked in program
    token_program: AccountInfo<'info>,
    system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(vault_owner_bump: u8)]
pub struct CloseMarket<'info> {
    #[account(mut, has_one=vault, constraint = market.admin == admin.key())]
    market: Account<'info, Market>,
    admin: Signer<'info>,
    
    #[account(mut, has_one=owner)]
    vault: Box<Account<'info, TokenAccount>>,
    #[account(mut, owner=mpl_token_metadata::id())]
    /// CHECK: checked in program
    metadata: UncheckedAccount<'info>,
    #[account(seeds=[VAULT_OWNER_PREFIX.as_bytes(), market.resource.as_ref(), market.store.as_ref()], bump=vault_owner_bump)]
    /// CHECK: checked in program
    owner: UncheckedAccount<'info>,
    #[account(mut)]
    destination: Box<Account<'info, TokenAccount>>,
    token_program: Program<'info, Token>,
    /// CHECK: checked in program
    token_metadata_program: UncheckedAccount<'info>,
    system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction()]
pub struct SuspendMarket<'info> {
    #[account(mut, has_one=admin)]
    market: Account<'info, Market>,
    admin: Signer<'info>,
    clock: Sysvar<'info, Clock>,
}

#[derive(Accounts)]
#[instruction()]
pub struct ResumeMarket<'info> {
    #[account(mut, has_one=admin)]
    market: Account<'info, Market>,
    admin: Signer<'info>,
    clock: Sysvar<'info, Clock>,
}

#[derive(Accounts)]
#[instruction(new_name: Option<String>, new_description: Option<String>, mutable: Option<bool>, new_price: Option<u64>)]
pub struct ChangeMarket<'info> {
    #[account(mut, has_one=admin)]
    market: Account<'info, Market>,
    admin: Signer<'info>,
    clock: Sysvar<'info, Clock>,
}
