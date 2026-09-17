import { ethers } from 'ethers';

// 常见 SeaDrop 与 ERC721SeaDrop 自定义错误签名库 (4-byte selectors)
const ERROR_SIGNATURES: Record<string, string> = {
  // SeaDropErrors / ISeaDrop (Canonical EVM 4-byte selectors)
  '0x13da22f2': 'NotActive(uint256,uint256,uint256) - 铸造尚未开始或已结束',
  '0x914edb0f': 'MintNotActive() - 铸造当前未激活',
  '0x198441cb': 'MintQuantityCannotBeZero() - 铸造数量不能为 0',
  '0xd40604cf': 'ExceedsMaxTotalMintableByWallet(uint256,uint256) - 超过该钱包允许铸造的最大总数',
  '0x9943b7e7': 'MaxTotalMintableByWalletCannotBeZero() - 钱包最大铸造额度未设置',
  '0x0d35e921': 'IncorrectPayment(uint256,uint256) - 支付金额与价格不符',
  '0x5136e8d5': 'FeeRecipientCannotBeZeroAddress() - 协议手续费接收地址不能为空 (零地址)',
  '0xf477d26f': 'FeeRecipientNotAllowed() - 该手续费接收者不在允许列表中',
  '0x0998fbbd': 'FeeRecipientNotPresent() - 手续费接收者未配置',
  '0x7a66b5b9': 'CreatorPaymentAddressCannotBeZeroAddress() - 创建者收款地址为空',
  '0x8eb5b891': 'InvalidPayer() - 付款人地址无效',
  '0x4cc11713': 'PayerNotPresent() - 付款人不存在',
  '0x8baa579f': 'InvalidSignature() - 签名验证失败',
  '0xcfb6108a': 'SignerCannotBeZeroAddress() - 签名者地址为空',
  '0x815e1d64': 'InvalidSigner() - 签名者无效',
  '0x09bde339': 'InvalidProof() - 白名单默克尔树证明 (Merkle Proof) 无效',
  '0x8b85ae22': 'AllowListNotActive() - 白名单阶段未激活',
  '0xdf0b7a45': 'TokenGatedNotActive() - 代币门槛铸造阶段未激活',
  '0x8abd99d7': 'CannotSetFeeBpsAboveMaximum() - 费率基点超过上限',
  '0xb40637e4': 'SignerNotPresent() - 签名者未指定',

  // ERC721SeaDrop / ERC721A 常见错误
  '0xe12d2314': 'MintQuantityExceedsMaxSupply(uint256,uint256) - 超过合约最大总供应量 (已售罄)',
  '0xf1c35d7c': 'CannotMintMoreTokensThanMaxSupply() - 剩余代币不足以满足此次铸造数量 (已售罄)',
  '0xbb5e1ad0': 'SeaDropMintCannotBeZero() - SeaDrop 铸造数量不能为 0',
  '0x15e26ff3': 'OnlyAllowedSeaDrop() - 仅允许指定 SeaDrop 合约调用',
  '0x9e713b6c': 'SeaDropMintExceedsMaxSupply() - 铸造超过最大发行量',
  
  // OpenZeppelin ERC20 / Ownable / Pausable
  '0x118cdaa7': 'EnforcedPause() - 合约当前处于暂停状态',
  '0x8c65f846': 'ExpectedPause() - 合约预期为暂停状态',
  '0x1f2a2005': 'OwnableUnauthorizedAccount(address account) - 仅限合约所有者',
  '0xf4d678b8': 'ERC721InvalidOwner(address owner) - 非法代币所有者',
  '0x722713f7': 'ERC721NonexistentToken(uint256 tokenId) - 代币不存在',
  '0xe450d38c': 'ERC20InsufficientBalance(address sender, uint256 balance, uint256 needed) - ERC20 余额不足',
  '0x4e487b71': 'Panic(uint256 code) - Solidity Panic 异常'
};

/**
 * 深入解析各类以太坊 / EVM Revert 异常并提取可读中文诊断
 */
export function decodeContractError(error: any): {
  selector?: string;
  reason: string;
  tip?: string;
} {
  if (!error) return { reason: '未知错误' };

  // 1. 尝试从 error 对象结构中提取 data / revert data
  let dataHex: string | null = null;

  // ethers v6 各属性路径
  if (error.data && typeof error.data === 'string' && error.data.startsWith('0x')) {
    dataHex = error.data;
  } else if (error.error?.data && typeof error.error.data === 'string' && error.error.data.startsWith('0x')) {
    dataHex = error.error.data;
  } else if (error.info?.error?.data && typeof error.info.error.data === 'string') {
    dataHex = error.info.error.data;
  } else if (error.info?.data && typeof error.info.data === 'string') {
    dataHex = error.info.data;
  } else {
    // 尝试从 message 字符串中正则匹配 0x[a-fA-F0-9]{8,}
    const msg = String(error?.message || error);
    const match = msg.match(/(0x[a-fA-F0-9]{8,})/);
    if (match && match[1]) {
      dataHex = match[1];
    }
  }

  // 2. 如果存在 dataHex，解析 4-byte selector
  if (dataHex && dataHex.length >= 10) {
    const selector = dataHex.slice(0, 10).toLowerCase();
    
    // 标准 Error(string) (0x08c379a0)
    if (selector === '0x08c379a0' && dataHex.length > 138) {
      try {
        const abiCoder = new ethers.AbiCoder();
        const decoded = abiCoder.decode(['string'], '0x' + dataHex.slice(10));
        return {
          selector,
          reason: `合约拒绝: ${decoded[0]}`,
          tip: '合约抛出带原因的 require/revert'
        };
      } catch {}
    }

    // 标准 Panic(uint256) (0x4e487b71)
    if (selector === '0x4e487b71' && dataHex.length >= 74) {
      try {
        const abiCoder = new ethers.AbiCoder();
        const decoded = abiCoder.decode(['uint256'], '0x' + dataHex.slice(10));
        const code = decoded[0].toString();
        const panicReasons: Record<string, string> = {
          '1': 'assert 失败',
          '17': '算术溢出或下溢 (underflow/overflow)',
          '18': '除以零',
          '33': '枚举转换越界',
          '34': '访问不存在的存储字节数组',
          '49': '空数组 pop 操作',
          '50': '数组索引越界 (Index out of bounds)',
          '65': '内存分配过大',
          '81': '调用零初始化的内部函数变量'
        };
        return {
          selector,
          reason: `Solidity Panic: ${panicReasons[code] || `Code ${code}`}`,
          tip: '通常由数值越界或断言触发'
        };
      } catch {}
    }

    // 匹配已知 SeaDrop / ERC721 错误库
    if (ERROR_SIGNATURES[selector]) {
      const detail = ERROR_SIGNATURES[selector];
      let tip = '';
      if (selector === '0x09bde339' || selector === '0x1254303d') {
        tip = '该项目公开发售（Public Drop）尚未开始，或者已经截止。可切换到「定时狙击」等待开售。';
      } else if (selector === '0x7234407b') {
        tip = '该钱包已经达到或者超过了单钱包最大允许铸造的上限。';
      } else if (selector === '0x6d9a9307') {
        tip = '发送的交易主币金额 (msg.value) 与 SeaDrop 规定的铸造价格不一致。';
      } else if (selector === '0xd2f588a4' || selector === '0x19a0a033' || selector === '0x24249a21') {
        tip = '该 NFT 已经全部铸造完毕（已售罄）。';
      } else if (selector === '0x69680b57') {
        tip = 'NFT 合约未允许当前 SeaDrop 路由地址调用，或者部署地址不匹配。';
      }
      return {
        selector,
        reason: detail,
        tip
      };
    }

    return {
      selector,
      reason: `未收录的自定义错误 Selector [${selector}]`,
      tip: '该合约触发了自定义 revert(CustomError)。常见原因为：发售时间未到、已售罄、或超出限额。'
    };
  }

  // 3. 回退分析普通文本报错
  const rawStr = String(error?.message || error?.shortMessage || error?.reason || error);

  if (rawStr.includes('NotActive') || rawStr.includes('MintNotActive')) {
    return {
      reason: '发售尚未开启或已截止 (NotActive)',
      tip: '请核对发售时间戳，建议在「定时狙击」中设置目标开售时间。'
    };
  }
  if (rawStr.includes('ExceedsMax') || rawStr.includes('MaxTotalMintable')) {
    return {
      reason: '超出钱包最大铸造额度限制',
      tip: '请减少数量（例如改为 1）或更换尚未铸造过该 NFT 的新钱包。'
    };
  }
  if (rawStr.includes('IncorrectPayment') || rawStr.includes('insufficient funds')) {
    return {
      reason: '支付金额不足或单价不符',
      tip: '请确认钱包有充足的 Gas 费及铸造价格所需的主币余额。'
    };
  }
  if (rawStr.includes('MaxSupply') || rawStr.includes('sold out')) {
    return {
      reason: 'NFT 已售罄 (MaxSupply reached)',
      tip: '该集合的总量已被完全铸造完毕。'
    };
  }

  // 4. 清洗截取错误字符串
  let cleaned = rawStr;
  if (cleaned.includes('execution reverted')) {
    const m = cleaned.match(/execution reverted:? ?([^,)"\n]*)/);
    if (m && m[1] && m[1].trim()) {
      cleaned = m[1].trim();
    }
  }
  if (error?.shortMessage) {
    cleaned = error.shortMessage;
  }

  return {
    reason: cleaned.length > 140 ? cleaned.slice(0, 140) + '...' : cleaned
  };
}
