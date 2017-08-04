// Copyright 2015-2017 Parity Technologies (UK) Ltd.
// This file is part of Parity.

// Parity is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.

// Parity is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.

// You should have received a copy of the GNU General Public License
// along with Parity.  If not, see <http://www.gnu.org/licenses/>.

import React, { Component } from 'react';
import PropTypes from 'prop-types';
import { FormattedMessage } from 'react-intl';
import { observer } from 'mobx-react';
import { connect } from 'react-redux';
import moment from 'moment';
import { throttle } from 'lodash';

import { Page, Tab } from '@parity/ui';
import Actionbar from './actionbar';
import Parameters from './parameters';
import Editor from '@parity/ui/Editor';

import DeployContract from '@parity/dapp-contracts/src/DeployContract';
import LoadContract from '../LoadContract';
import SaveContract from '../SaveContract';

import ContractDevelopStore from './store';
import styles from './contractDevelop.css';

import { Debugger } from 'parity-reactive-ui';

@observer
class ContractDevelop extends Component {
  static propTypes = {
    accounts: PropTypes.object.isRequired,
    worker: PropTypes.object,
    workerError: PropTypes.any
  };

  store = ContractDevelopStore.get();

  state = {
    resizing: false,
    size: 65
  };

  componentWillMount () {
    const { worker } = this.props;

    if (worker !== undefined) {
      this.store.setWorker(worker);
    }
    this.throttledResize = throttle(this.applyResize, 100, { leading: true });
  }

  componentDidMount () {
    this.store.setEditor(this.refs.editor);

    if (this.props.workerError) {
      this.store.setWorkerError(this.props.workerError);
    }

    // Wait for editor to be loaded
    window.setTimeout(() => {
      this.store.resizeEditor();
    }, 2000);
  }

  // Set the worker if not set before (eg. first page loading)
  componentWillReceiveProps (nextProps) {
    if (this.props.worker === undefined && nextProps.worker !== undefined) {
      this.store.setWorker(nextProps.worker);
    }

    if (this.props.workerError !== nextProps.workerError) {
      this.store.setWorkerError(nextProps.workerError);
    }
  }

  render () {
    const { sourcecode } = this.store;
    const { size, resizing } = this.state;

    const annotations = this.store.annotations
      .slice()
      .filter((a) => a.contract === '');

    const panes = [
      { menuItem: 'Parameters', render: () => <div>
        <Parameters store={ this.store } />
      </div> },
      { menuItem: 'Debugger', render: () => <Debugger contracts={ this.store.contracts } />
      }
    ];

    return (
      <div className={ styles.outer }>
        { this.renderDeployModal() }
        { this.renderSaveModal() }
        { this.renderLoadModal() }
        <Actionbar store={ this.store } />
        <Page className={ styles.page }>
          <div
            className={ `${styles.container} ${resizing ? styles.resizing : ''}` }
          >
            <div
              className={ styles.editor }
              style={ { flex: `${size}%` } }
            >
              <h2>{ this.renderTitle(this.store.selectedContract) }</h2>

              <Editor
                ref='editor'
                onChange={ this.store.handleEditSourcecode }
                onExecute={ this.store.handleCompile }
                annotations={ annotations }
                value={ sourcecode }
                className={ styles.mainEditor }
              />
            </div>

            <div className={ styles.sliderContainer }>
              <span
                className={ styles.slider }
                onMouseDown={ this.handleStartResize }
              />
            </div>

            <div
              className={ styles.parameters }
              style={ { flex: `${100 - size}%` } }
            >
              <Tab panes={ panes } />
            </div>
          </div>
        </Page>
      </div>
    );
  }

  renderTitle () {
    const { selectedContract } = this.store;

    if (!selectedContract || !selectedContract.name) {
      return (
        <FormattedMessage
          id='writeContract.title.new'
          defaultMessage='New Solidity Contract'
        />
      );
    }

    return (
      <span>
        { selectedContract.name }
        <span
          className={ styles.timestamp }
          title={
            <FormattedMessage
              id='writeContract.title.saved'
              defaultMessage='saved @ {timestamp}'
              vaules={ {
                timestamp: (new Date(selectedContract.timestamp)).toISOString()
              } }
            />
          }
        >
          <FormattedMessage
            id='writeContract.details.saved'
            defaultMessage='(saved {timestamp})'
            values={ {
              timestamp: moment(selectedContract.timestamp).fromNow()
            } }
          />
        </span>
      </span>
    );
  }

  renderDeployModal () {
    const { showDeployModal, contract, sourcecode } = this.store;

    if (!showDeployModal) {
      return null;
    }

    return (
      <DeployContract
        abi={ contract.interface }
        accounts={ this.props.accounts }
        code={ `0x${contract.bytecode}` }
        source={ sourcecode }
        onClose={ this.store.handleCloseDeployModal }
        readOnly
      />
    );
  }

  renderLoadModal () {
    const { showLoadModal } = this.store;

    if (!showLoadModal) {
      return null;
    }

    return (
      <LoadContract
        onLoad={ this.store.handleLoadContract }
        onDelete={ this.store.handleDeleteContract }
        onClose={ this.store.handleCloseLoadModal }
        contracts={ this.store.savedContracts }
        snippets={ this.store.snippets }
      />
    );
  }

  renderSaveModal () {
    const { showSaveModal, sourcecode } = this.store;

    if (!showSaveModal) {
      return null;
    }

    return (
      <SaveContract
        sourcecode={ sourcecode }
        onSave={ this.store.handleSaveNewContract }
        onClose={ this.store.handleCloseSaveModal }
      />
    );
  }

  handleStartResize = () => {
    this.setState({ resizing: true });
  }

  handleStopResize = () => {
    this.setState({ resizing: false });
  }

  handleResize = (event) => {
    if (!this.state.resizing) {
      return;
    }

    const { pageX, currentTarget } = event;
    const { width, left } = currentTarget.getBoundingClientRect();

    const x = pageX - left;

    this.size = 100 * x / width;
    this.throttledResize();

    event.stopPropagation();
  }

  applyResize = () => {
    this.setState({ size: this.size });
  }
}

function mapStateToProps (state) {
  const { accounts } = state.personal;
  const { worker, error } = state.worker;

  return {
    accounts,
    worker,
    workerError: error
  };
}

export default connect(
mapStateToProps,
null
)(ContractDevelop);
