use crate::{
    error::ErrorCode,
    state::{MarketState},
    utils::*,
    Buy,
};
use anchor_lang::prelude::*;

use anchor_spl::token;

impl<'info> Buy<'info> {
    pub fn process(
        &mut self,
        vault_owner_bump: u8
    ) -> Result<()> {
        let market = &mut self.market;
        let buyer_wallet = &mut self.buyer_wallet;
        let buyer_receiver_token_account = &mut self.buyer_receiver_token_account;
        let vault_token_account = &mut self.vault_token_account;
        let buyer_exchange_token_account = &mut self.buyer_exchange_token_account;
        let buyer_exchange_resource_mint = &mut self.buyer_exchange_resource_mint;
        let master_edition_info = &self.master_edition.to_account_info();
        let metadata = &self.metadata;

        let vault = &mut self.vault;
        let owner = Box::new(&self.owner);
        let clock = &self.clock;
        let token_program = &self.token_program;

        if market.appointed_wallets.len() > 0 {
            let existed = market.appointed_wallets
                .iter()
                .position(|a| a == buyer_wallet.key)
                .unwrap_or(usize::MAX);
            
            if existed == usize::MAX {
                return Err(ErrorCode::NotAppointedBuyer.into());
            }
        }

        // Check, that `Market` is not in `Suspended` state
        if market.state == MarketState::Suspended {
            return Err(ErrorCode::MarketIsSuspended.into());
        }

        // // Check, that `Market` is started
        if market.start_date > clock.unix_timestamp as u64 {
            return Err(ErrorCode::MarketIsNotStarted.into());
        }

        // Check, that `Market` is ended
        if let Some(end_date) = market.end_date {
            if clock.unix_timestamp as u64 > end_date {
                return Err(ErrorCode::MarketIsEnded.into());
            }
        } else if market.state == MarketState::Ended {
            return Err(ErrorCode::MarketIsEnded.into());
        }

        if market.state != MarketState::Active {
            market.state = MarketState::Active;
        }

        // Check `MasterEdition` derivation
        assert_derivation(
            &mpl_token_metadata::id(),
            master_edition_info,
            &[
                mpl_token_metadata::state::PREFIX.as_bytes(),
                mpl_token_metadata::id().as_ref(),
                buyer_exchange_resource_mint.key().as_ref(),
                mpl_token_metadata::state::EDITION.as_bytes(),
            ],
        )?;

        // Check, that provided metadata is correct
        assert_derivation(
            &mpl_token_metadata::id(),
            metadata,
            &[
                mpl_token_metadata::state::PREFIX.as_bytes(),
                mpl_token_metadata::id().as_ref(),
                buyer_exchange_resource_mint.key().as_ref(),
            ],
        )?;

        let metadata =
            mpl_token_metadata::state::Metadata::from_account_info(&metadata.to_account_info())?;

        // Check, that at least one creator exists in primary sale
        if !metadata.primary_sale_happened {
            if let Some(creators) = metadata.data.creators {
                if creators.len() == 0 {
                    return Err(ErrorCode::MetadataCreatorsIsEmpty.into());
                }
            } else {
                return Err(ErrorCode::MetadataCreatorsIsEmpty.into());
            }
        }

        let master_edition =
            mpl_token_metadata::state::MasterEditionV2::from_account_info(master_edition_info)?;

        if let Some(me_max_supply) = master_edition.max_supply {
            let available_supply = me_max_supply - master_edition.supply;
            if available_supply < 1 {
                return Err(ErrorCode::SupplyIsGtThanAvailable.into());
            }
        }

        // check if vault_token_account is in allowed_list
        let index = market.receiver_token_accounts.iter().position(|&r| r == vault_token_account.key()).unwrap_or(usize::MAX);
        
        if index == usize::MAX {
            return Err(ErrorCode::InvalidInputTokenAccount.into());
        }

        let authority_seeds =  &[
            VAULT_OWNER_PREFIX.as_bytes(),
            market.resource.as_ref(),
            market.store.as_ref(),
            &[vault_owner_bump],
        ];

        let signer = &[&authority_seeds[..]];
        let cpi_ctx = CpiContext::new_with_signer(
            token_program.to_account_info(),
            token::Transfer {
                from: vault.to_account_info(),
                to: buyer_receiver_token_account.to_account_info().clone(),
                authority: owner.to_account_info()
            },
            signer
        );

        token::transfer(cpi_ctx, 1)?;

        // send buyer token to vault token account
        let cpi_program = token_program.to_account_info();
        let cpi_accounts = token::Transfer {
            from: buyer_exchange_token_account.to_account_info(),
            to: vault_token_account.to_account_info(),
            authority: buyer_wallet.to_account_info(),
        };
        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
        token::transfer(cpi_ctx, 1)?;

        market.state = MarketState::Ended;

        Ok(())
    }
}
