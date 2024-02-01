use crate::{
    error::ErrorCode,
    state::{MarketState, MarketType},
    utils::*,
    CreateMarket,
};
use anchor_lang::{
    prelude::*
};

use anchor_spl::token;

impl<'info> CreateMarket<'info> {
    pub fn process(
        &mut self,
        name: String,
        description: String,
        mutable: bool,
        allowed_tokens: Vec<Pubkey>,
        receiver_token_accounts: Vec<Pubkey>,
        appointed_wallets: Vec<Pubkey>,
        start_date: u64,
        end_date: Option<u64>,
    ) -> Result<()> {
        let market = &mut self.market;
        let store = &self.store;
        let mint = self.mint.to_account_info();
        let owner = &self.owner;
        let admin = &self.admin;
        let master_edition_info = &self.master_edition.to_account_info();
        let metadata = &self.metadata;
        let vault = &self.vault;
        let resource_token = &self.resource_token;
        let token_program = &self.token_program;

        if name.len() > NAME_MAX_LEN {
            return Err(ErrorCode::NameIsTooLong.into());
        }

        if description.len() > DESCRIPTION_MAX_LEN {
            return Err(ErrorCode::DescriptionIsTooLong.into());
        }

        if allowed_tokens.len() == 0 || (receiver_token_accounts.len() != allowed_tokens.len()) {
            return Err(ErrorCode::WrongAllowedTokens.into());
        }

        // start_date cannot be in the past
        if start_date < Clock::get().unwrap().unix_timestamp as u64 {
            return Err(ErrorCode::StartDateIsInPast.into());
        }

        // end_date should not be greater than start_date
        if end_date.is_some() && start_date > end_date.unwrap() {
            return Err(ErrorCode::EndDateIsEarlierThanBeginDate.into());
        }

        // Check `MasterEdition` derivation
        assert_derivation(
            &mpl_token_metadata::id(),
            master_edition_info,
            &[
                mpl_token_metadata::state::PREFIX.as_bytes(),
                mpl_token_metadata::id().as_ref(),
                mint.key().as_ref(),
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
                mint.key().as_ref(),
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

        // Transfer `MasterEdition` ownership
        let cpi_program = token_program.to_account_info();
        let cpi_accounts = token::Transfer {
            from: resource_token.to_account_info(),
            to: vault.to_account_info(),
            authority: admin.to_account_info(),
        };
        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
        token::transfer(cpi_ctx, 1)?;

        market.store = store.key();
        market.admin = admin.key();
        market.name = puffed_out_string(name, NAME_MAX_LEN);
        market.description = puffed_out_string(description, DESCRIPTION_MAX_LEN);
        market.resource = mint.key();
        market.vault = vault.key();
        market.vault_owner = owner.key();
        market.mutable = mutable;
        market.start_date = start_date;
        market.end_date = end_date;
        market.allowed_tokens = allowed_tokens;
        market.receiver_token_accounts = receiver_token_accounts;
        market.appointed_wallets = appointed_wallets;
        market.state = MarketState::Created;
        market.market_type = MarketType::SingleVsSingle;

        Ok(())
    }
}
