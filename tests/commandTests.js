/* eslint-disable no-new */
// disable no-new because ctors blowing up is a reasonable test imo
const mocha = require('mocha');
const chai = require('chai');
const requireInject = require('require-inject');
const extensions = require('../extensions');

let lastLoggedMsg = '';
const commands = requireInject('../commands', {
  os: {
    EOL: '\r\n',
  },
  '../logger': {
    log: (msg) => {
      lastLoggedMsg = msg;
    },
  },
});

extensions(); // load up Math.randomInt

const describe = mocha.describe;
const it = mocha.it;
const assert = chai.assert;

mocha.beforeEach(() => {
  lastLoggedMsg = '';
});

mocha.afterEach(() => {
  lastLoggedMsg = '';
});

describe('command base', () => {
  it('should throw error when not provided client', () => {
    assert.throws(() => {
      new commands.CommandBase(null, {});
    });
  });

  it('should throw error when not provided cmdData', () => {
    assert.throws(() => {
      new commands.CommandBase({}, null);
    });
  });

  it('should throw error when not provided cmdData.name', () => {
    assert.throws(() => {
      new commands.CommandBase({}, {});
    });
  });

  it('should reply successfully', () => {
    const base = new commands.CommandBase({}, {
      name: 'test',
    });
    const cmdMock = {
      channel: {
        send: msg => Promise.resolve(msg),
      },
    };

    return base
      .send('test msg', cmdMock)
      .then((reply) => {
        assert.strictEqual(reply, 'test msg');
      });
  });

  it('should log error if error', () => {
    const base = new commands.CommandBase({}, {
      name: 'test',
    });
    const cmdMock = {
      channel: {
        send: msg => Promise.reject(msg),
      },
      content: 'command',
    };

    return base
      .send('test msg', cmdMock)
      .then(() => {
        // success cb; it failed, ignore
        assert.strictEqual(lastLoggedMsg, 'Failed on replying :: Original message: "command" :: Error: "test msg"');
      });
  });
});

describe('name generation command', () => {
  it('should return early with error message if parsedArgs have error', () => {
    const generator = {};
    const argsParserMock = {
      parseArgs: args => ({
        error: 'error',
      }),
    };

    const userCommandRequest = {
      channel: {
        send: msg => Promise.resolve(msg),
      },
      content: 'command',
    };

    const command = new commands.NameGenerationCommand({}, argsParserMock, generator);

    return command
      .run(userCommandRequest, 'error me papi')
      .then((r) => {
        assert.strictEqual(r, '**error**');
      });
  });

  it('should return early with error message if generated has error', () => {
    const generator = {
      generateName: args => ({
        error: 'error',
      }),
    };
    const argsParserMock = {
      parseArgs: args => ({
      }),
    };

    const userCommandRequest = {
      channel: {
        send: msg => Promise.resolve(msg),
      },
      content: 'command',
    };

    const command = new commands.NameGenerationCommand({}, argsParserMock, generator);

    return command
      .run(userCommandRequest, 'error me papi')
      .then((r) => {
        assert.strictEqual(r, '**error**');
      });
  });

  it('should include message if message comes from args', () => {
    const generator = {
      generateName: args => ({
        message: '',
        names: [],
      }),
    };
    const argsParserMock = {
      parseArgs: args => ({
        message: 'message\r\n',
      }),
    };

    const userCommandRequest = {
      channel: {
        send: msg => Promise.resolve(msg),
      },
      content: 'message',
    };

    const command = new commands.NameGenerationCommand({}, argsParserMock, generator);

    return command
      .run(userCommandRequest, '')
      .then((r) => {
        assert.include(r, 'message');
      });
  });

  it('should include message if message comes from generated', () => {
    const generator = {
      generateName: args => ({
        message: 'message/r/n',
        names: [],
      }),
    };
    const argsParserMock = {
      parseArgs: args => ({
        message: '',
      }),
    };

    const userCommandRequest = {
      channel: {
        send: msg => Promise.resolve(msg),
      },
      content: 'message',
    };

    const command = new commands.NameGenerationCommand({}, argsParserMock, generator);

    return command
      .run(userCommandRequest, '')
      .then((r) => {
        assert.include(r, 'message');
      });
  });

  it('should have generated names in response message', () => {
    const generator = {
      generateName: args => ({
        message: '',
        names: ['juan', 'charles', 'mikhail'],
      }),
    };
    const argsParserMock = {
      parseArgs: args => ({
        message: '',
      }),
    };

    const userCommandRequest = {
      channel: {
        send: msg => Promise.resolve(msg),
      },
      content: 'message',
    };

    const command = new commands.NameGenerationCommand({}, argsParserMock, generator);

    return command
      .run(userCommandRequest, '')
      .then((r) => {
        assert.strictEqual(r, 'juan\r\ncharles\r\nmikhail');
      });
  });

  it('should pop names if return message too long and include message', () => {
    let name2000CharactersLong = 'a';
    for (let i = 0; i < 2000; i++)
      name2000CharactersLong += 'a';

    const generator = {
      generateName: args => ({
        message: '',
        names: [
          'juan',
          'charles',
          name2000CharactersLong,
        ],
      }),
    };

    const argsParserMock = {
      parseArgs: args => ({
        message: '',
      }),
    };

    const userCommandRequest = {
      channel: {
        send: msg => Promise.resolve(msg),
      },
      content: 'message',
    };

    const command = new commands.NameGenerationCommand({}, argsParserMock, generator);

    return command
      .run(userCommandRequest, '')
      .then((r) => {
        assert.notInclude(r, name2000CharactersLong);
        assert.include(r, 'juan\r\ncharles');
        assert.include(r, "*The list of names would exceed Discord's character limit. Removed 1 name(s).*");
      });
  });
});