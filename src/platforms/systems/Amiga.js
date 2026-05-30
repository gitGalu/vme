import PlatformBase from '../PlatformBase.js';
import { JOYSTICK_TOUCH_MODE, MOUSE_TOUCH_MODE } from '../../Constants.js';

const AMIGA_PINBALL_1_HASHES = Object.freeze([
  '228f2d9de0af736405660cdb8c06586c68e805fbc05b98c8fd09f59e30b5e34d',
  'f2228ac53c8aeb6300f33d2c86e1bdcb558485f9205d1a630c8ca068e70c6e04',
  '3fd8fc83e3fb6707be1007ef8595fb640d30fb04f10f0cc2a8332991cb4a01ae',
  'ab31479493b3590bce66d3793d6803b81640016a515ce7c62c5ff57873cd0add',
  '3b88962d897f2d4a427613ca119a6c445a8aa514e43451748e371826fe2cce60',
  '03aff397fd80ec1c91658f57df62bba6f0ce8189a76c49c050bf27f768d26e36',
  '257475c53aadecc0b104da9a174dbfaced5320ddd47df032408a47e5e089c075',
  '3034ba7474a0cab46951805bae298ba3e2c13f5b872b4be32db0e3fd429ed429',
  '69748654df83aa97c1b9cad6adc4b1b323bb5b4c40e40aa29847d114d7c77b35',
  '20cffae40e439226064b9a8adbd1008aebe884ef0cbf645b630490e1f345324a',
  '73f0e25803740df3628a1c99f6cb5786905070eb938fd23be0f2a4a013957955',
  '149eecc74d3b1f4e55390771dd0b0a3af4fe2f90a8fbdf2cab8839906b0c2f4c',
  'e7d2736812076d288de139c91e2a8d0076a4a4395b26433fdeea78001a1ddea9',
  '9a156d2d8f7fd910d0d2306b4041686d0fc8b9f3d6082481f85704b61f47aff2',
  '4dafce9a111be844ede229c431e8d0d53cf753a9151273bc3b6782e6050d6cbf',
  'afc65452bc54916fa071b45704f553856ba8bca4e5e1c0e46c76b7a674d27910',
  'eb234435a82c5fca3c4fc6023762fdbc643a3eaeb36e197c55bd31b98bf49295',
  '60c77d82d9c268933c265867ab47953fc2f32dc3faddd4d27937c69594a3e837',
  '82e5f3983899f19b26cc5672bf080415da6516afd2b45ad8b39fd5acd9ca27e1',
  'b0c7b06bbefdb8f04eefceab4f0d34385c76bea7cd4559ae34e5fe4f7f0e06ad',
  '8c811a0eaff6eb5515e9970550a9d420696f009cd80694c5af562452e85818d7',
  '3e93f670da90ca09bc07d77235878b34d55859e966be427b08175430412395e1',
  'd3547ce3775d831830005ea63c03a61f2b40877aba782cea0e3b777a3681f07a',
  'cf578bd90f1789912e7d4e9b7df25e2062a6f0a262afe121d552d8da9bb4a9af',
  '45f4648ee5a1dfb3e44452763ab9b9639d9b8b3a8083518aaf45b356262fd6d6',
  'b2afc964f6fa897dce65ed04728892c07b8466d56eb7cb5f0ef6df9556284aa9',
  'fe06c44019e725e1a6b85ce2b92b2a9fcb75fed666d1720ecb55e07d8b264fcd',
  '4a62a5a878f6d84662998f008f2d07e929b58ee292ecf9238d7addd22a84c2e6',
  '5a68a7d25edeed3a52b69c69c9554bec5444fa5ccfd5cd2a3c389c610964227c',
  '3ce2c87b04a35cd5b8523b31c28f3436b6768ffa8ba574a0dfc5b95758e43280',
  '9bebe1aeeaba05675b12d6ef9188781acfca9ecd0ab7693ad025695391847b1b',
  'bfed3aaf56186ec194d6e1c6436ecf5fd65e8feb961d31e09e0202b921cd3425',
  '385dc9c3a5f83206a711e6878b174630c88b852d4a260a0504db085b5a740db3',
  'cc6bd12d4b73590c488c71fc0cb53e11d2e9b5df7537453fec2b1fd0e1cf956f',
  '005fe913655890010f9cc13306e951ba53fd1317a3cda77bf0091c38c301d8d9',
  'ea0478bfafceaa1a08c64be30af3378d57e84615cb5a5701b46fabb1a22aa097',
  'ea14c0fc34d6ebf7217d5af78e94ab090db3ab311c0eb936869198f50483d23c',
  '326e6327c0b5ac8f9fe730670918d4a050654f322e1ce39b78314968f3ba66ac',
  '4eaf9e8e892c74f8d3c04424cc7b66f2564a75605d4f97921a0e4e9d50c16d5c',
  'bfaf6929557311eee4d9a97185a99632b4b819adf14040e75e7bedf2c90c219a',
  '3211df1a4bc37d20045a6ac5fe205e62773b435b1f2a3671d6670b19880e05ed',
  '27c2239eb2971f145dda56fe472980f000a2f4de3b28defeffcea7ef6842ae06',
  '5dc56999f22b21b6b5d2501b580de1fad9099a2f2969e25f0c160b611194cb81',
  '796667300973ced64830c27781c29ae2bc7bacf659cc46871e4287313dcd6c02',
  'c21b4c7e38297a172ff97e661a325cf6ea313e77a808717a3dcd0f81e0810f34',
  '12f5ab6d71718ac324fe1dece693ad24f1b398a85c24fba03694bfaefd1697fe',
  'ee85c7fa0825d245331c5fe134ed7acd9269fbdc69f54543c941dfe5e08c3f2a',
  'ac0339d04ad56d8d9bdb472c1d9af2baf970d71f5e2f72b68ebff23894fe3528',
  'bf6877ec122e03ed2a2a37099c065aaade435703d93acf066d98adc9b66e60f3',
  '1fa7391168746858829332268a6bf660addc1a13769fc9776791f85f47ab1d48',
  '3dcfa9e470edd3cf714f9ab55eaaea192832214e631ef40a8f09bab35ee538e3',
  'af264f77fe6a5c4f701c63a79dcc48d7eeb6861d82edcbbbcb5d348b13696c01',
  '0c0c676962f8cb0409965d56ad3a3c9ecd01e898ed7b75d361515e7190e68459',
  '1f2f58c0f3d575288943b6f71646bf25b339725028fcbf348dfc013cc3809430',
  'b71f21328ace2db38642962f792ed70936b86bf94fb37830c10b24d624b39bdb',
  '589d9683a76499923999256fa3dc77a2c60052af4d25e04b173562c9a1e94050',
  '05e8785765cb668025d6e601e7ee095805ceab432f5654070a10263ee640cd24',
  '82af00bec40475d044321aa4b8392165533ce4d397db042e5549ff82474efe5f',
  'e512ded38b8aef573080de9e7bed24bf7f68a86cf6d52b94070c0caee1f926f0',
  '67b0517891cd012119d28481dbde3ce178ec90557cc7dd3e3cf9b39e66d0d645',
  '3b00adaa28a1c850901a34cf963d9bc48563ed8e03c9b5a46570dc3eff81d9fc',
  'd3fcdc1594ddc7815f363beca44c1c7d291b9a9772fd4a6f164c54e9cc100f71',
  '7c05270412739fc3957c0a5f60dfdbad876d4727ef82ebbd2435e396ab4f5f9e',
  '42d3907e98e0429bce2ead9d03f97081610aeb79a192366cfc6110b4e933cbf2',
  '19faa1f4d8240424f6b45ecb9f046d001f3a386293e7eb0339912e80205b9708',
  'caec394beef358f5c249ae64874bfd4d0946491c1a465609ffb8f05e92c4d68b',
  '52ab3596fcca0b20fef7bb0ab62ccc69f65a9ea50165ca216308945178d9e6f1',
  'da72c6b43520906befe5e6e39311deaf2b5bebd23526ecf6101fe4b2a0098060',
  'c70570d602b7647d3e8c6679bbd5b877830a28777f27e38819e76d2179c457e6',
  'ffb91ff90598cba5bfd8019c87ecde24896ea230c640ea13626b7fd42e8c51ce',
  '63de3ae3b88df0607194e3a5b1d270b25b089fee47cc0bd11afaf7f472f9ba20',
  'be59af7625df0c9df2638082ae58d1e7d1ca01d9756e723867779cf25553b868',
  '8203c38a9dc9783382b3d408c43c729b13291412ef18cc6fb11a3def5db4819e',
  'd2aa0811a306f032932329ca980825a98e81cefe9c6cda2e396279e64f7884bf',
  '011c28771a7bcb0a75bfa78730836c81d320ccdc85b952249126687dedd2a8fe',
  '9e08515dae5f667741c416f311625951186a3b839a7fcf10e02e4cc652db613a',
  '939b48e2e01acfa68cf2c1a71a9fa0d1c8a2308b50eeb909ab73e4c4cab9b790',
  '37c0f0339db2ece6a74c1a87b7d6d625238a57ff5865b184c4216d1cf66d6658',
  'f52a081e2031d1ee995f81d31c2b7bbcb5783a52b5ad2d8389ea7518b86f2e86',
  'cb6fefd9e9f97f8ca32996602fcc76429843537e77f802860bae3aaf076a27f2',
  '7f272977fe884be9200345058bd65c440d4e0405570b79a2504e3bceb1bd4b7e',
  '47f3aeeb465231aa4f0cbeb6c9c8ff4d638b3abcffd5582ecb274f2139e7d0f0',
  'cccfca6189d747c59f64edaeb0a6dbee0b33add92987279b533bb1bb5bd46281',
  'e892ed1f07f3fe6f1a51c5809c83fc0f20ba5dbcc451e5b39090ee4f33108736'
]);

const AMIGA_PINBALL_2_HASHES = Object.freeze([
    "78350f24d4032861184550eb1794927114b539f302a90bd59353a0d1482edeb6",
    "eb1dc2a9b02dc0ee81982729d19e5b34cab715ca29e20cd2019a3f1c5ed8fd58",
    "8f0075b0ecfd3a6708965014a1bd7c47040cb54900aebf8240cfa282de734a9d",
    "680e8e84a21efe06b12108b0e08d59819ebda8a85b5d0fa0820197935cadcdc7",
    "60a748f05334bb618a82608e9b31eb29db2932b2d3587a9901a521b121ba5b81",
    "f3ef09a054ce4983586082618612686d997e5bdf07934a071a460215ffb864b4",
    "5ed7af898d8b4086d903b90a01afc72b6bfe173e5b9934303676218e67235417",
    "091f261d60866625550311768cc3f25d3b05e667590868a1368ed35ce140c151",
    "3b1d6ee6d9f4848315144d6da1ecc7963f201cc96eb813db4a0e595ec23c596b",
    "d17013173479916eb6ea9b396c0dd312b09688eed63918945e338efd96959758",
    "e4159a0d85ea9424020100e35cc64ce3d0247c6701c8fb46192a2666b52058b9"
]);

const AMIGA_PINBALL_3_HASHES = Object.freeze([
    "26284b7a61e2be800d92afb97240a0a1f25faadd0bc8ed0b0c57394276c0f26d",
    "e575eb2b3beef78f88fa098861feee371a338534dea673a2bbfa0afa344abb60",
    "42825960f1a05ac4cdbd6fafb948c2e2395adef6412ee5fd6e6e1a3c1950a605",
    "b4154e5ad894a4de1bd81d073a0bf61546c2a4ae05fa982871181fcadd79e13f",
    "b15febfe4722acbe399ed87f21c25716d76ae428c58f5348166756be5b81b41c",
    "399693b9e16da636f376eddadf7307f81379fe6d35c225a1926c59fb0e5309c0",
    "3038d16e6ea8d7899cd76cc7dc4a3d80d59dd0ace4980288e5bc47de72c022b3",
    "1764be4de3c4a8ae26522814a7e0974e539a644b74223311a2ff1b93f6f61dc9",
    "6de29dad755db9dabdfaa6c6f0a9fa96cb500e731afde049fecd4659ab112d5d",
    "e806eaff2cfff682001ec757f639f09e969721e1082c3dbd3be9c5a6ca4aa6b8",
    "865c8a103bda7bfb94ecd55ac7bbd5899f587b0daf3daa4ff4cc77f42afdda0c",
    "7a9e4b83100e400fac2516ee7f4e1003ed7bf36b4d864efb582420f8433950af",
    "047c3777785c2416d7207c25841bcc62abe0d37a5398728b8b08c8c9acf4a609",
    "33d0331af9b41ae61dada287948010157ab172c2c73aacfa3bb11817b9d659cb",
    "3113764c5a2781e8816938ed35e79ac5483f8c715e2687b428c7aea98ecb3670",
    "a3e9cfcf9cfbc577daac7512ceccce52d79491eb305e106ea1b3d1ba45870a6c",
    "d460a61f852e67e2c71261c6c1fcf9bcca4c30d97eb350524b518d982495eb73",
    "963e205630049537ea135f5d12ebfb8814c8004dc451b5ba21c2b3740aa81766"
]);

const AMIGA_WORMS = Object.freeze([
    "ac2f89bc1b226f5cbceba8c4134b0601597c56525430697a5504104b6ec75b1e",
    "30201309786542eb39719b829a246f9e64aab03b8647d0929a7b853f5e42ac45",
    "789afaf1e74844901916c0352cb43ff1f492bb9d09502428d090f0e9aadccabf",
    "573c892685979ede3dd9dcd455efaab163c775a0ad96dd0beecb66070ffb6c19",
    "84bbace94b0fb4b79add9f7d9899e8252c7b44256817dc075fe2e642489a6295",
    "8226c9e28b4169f5d1f81d0bd2c6ebf11437f48272e89fc318aab21f458564e2",
    "fd0171f75b3c39f4ab705d37a0380709c397c87a6fcd95a62b54e06baa0696bb",
    "1dafebb4b7198c525508fdc7b3bb55d2c7fabdaa2768f0df89d778c4b0fd0032",
    "b6fb01c1260893e68257eced43530770170fdd07eb586178efcd326d4875b0af",
    "7b487593212af9ae21dcdce4f802983fe33413f2ed933be593280178aaa8bcf0",
    "8ef9223a470e03185090b72e9934779fe2480ae5470364149d7821fd936f783a",
    "08928792fc5f9775aa2c607b790d04b06c73f907675f77009e9b3b0b3d0b15be",
    "cc91e2c324b48b5eb07b94a77bb49e7fadd6efc16785d07bd9eeb2b1d5bcc839",
    "36c58219a09f7955bbd7f9bd108c1936233bbecba271183b65801e1eeb0f7ada"
]);

const AMIGA_MODEL_PRESET_OPTIONS = Object.freeze([
  { value: 'auto', label: 'Auto' },
  { value: 'A500', label: 'A500 OCS, 512K Chip + 512K Slow, KS 1.3', requiredBios: ['kick34005.A500'], defaultAvailable: true },
  { value: 'A500PLUS', label: 'A500+ ECS, 1MB Chip, KS 2.04', requiredBios: ['kick37175.A500'] },
  { value: 'A600', label: 'A600 ECS, 2MB Chip + 8MB Fast, KS 3.1', requiredBios: ['kick40063.A600'], defaultAvailable: true },
  { value: 'A1200OG', label: 'A1200 AGA, 2MB Chip, KS 3.1', requiredBios: ['kick40068.A1200'], defaultAvailable: true },
  { value: 'A1200', label: 'A1200 AGA, 2MB Chip + 8MB Fast, KS 3.1', requiredBios: ['kick40068.A1200'], defaultAvailable: true },
  {
    value: 'A1200_030',
    label: 'A1200 030 AGA, 2MB Chip + 8MB Fast, KS 3.1',
    requiredBios: ['kick40068.A1200'],
    defaultAvailable: true,
    coreConfig: {
      puae_model: 'A1200',
      puae_cpu_model: '68030',
      puae_fastmem_size: '8'
    }
  },
  {
    value: 'A1200_040',
    label: 'A1200 040 AGA, 2MB Chip + 8MB Fast, KS 3.1',
    requiredBios: ['kick40068.A1200'],
    defaultAvailable: true,
    coreConfig: {
      puae_model: 'A1200',
      puae_cpu_model: '68040',
      puae_fpu_model: 'cpu',
      puae_fastmem_size: '8'
    }
  },
  {
    value: 'A1200_060',
    label: 'A1200 060 AGA, 2MB Chip + 8MB Fast + 128MB Z3, KS 3.1',
    requiredBios: ['kick40068.A1200'],
    defaultAvailable: true,
    coreConfig: {
      puae_model: 'A1200',
      puae_cpu_model: '68060',
      puae_fpu_model: 'cpu',
      puae_fastmem_size: '8',
      puae_z3mem_size: '128'
    }
  },
  { value: 'A4030', label: 'A4000/030 AGA, 2MB Chip + 8MB Fast, KS 3.1', requiredBios: ['kick40068.A4000'] },
  { value: 'A4040', label: 'A4000/040 AGA, 2MB Chip + 8MB Fast, KS 3.1', requiredBios: ['kick40068.A4000'] },
  { value: 'CD32', label: 'CD32 AGA, 2MB Chip, KS 3.1', requiredBiosAny: [['kick40060.CD32.combined'], ['kick40060.CD32', 'kick40060.CD32.ext']] },
  { value: 'CD32FR', label: 'CD32 AGA, 2MB Chip + 8MB Fast, KS 3.1', requiredBiosAny: [['kick40060.CD32.combined'], ['kick40060.CD32', 'kick40060.CD32.ext']] },
  { value: 'A500OG', label: 'A500 OCS, 512K Chip, KS 1.2', requiredBios: ['kick33180.A500'], enabled: false },
  { value: 'A2000OG', label: 'A2000 OCS, 512K Chip + 512K Slow, KS 1.2', requiredBios: ['kick33180.A500'], enabled: false },
  { value: 'A2000', label: 'A2000 ECS, 1MB Chip, KS 3.1', requiredBios: ['kick40063.A600'], enabled: false },
  { value: 'CDTV', label: 'CDTV OCS, 1MB Chip, KS 1.3', requiredBios: ['kick34005.A500', 'kick34005.CDTV'], enabled: false }
]);

const AMIGA_VIDEO_STANDARD_OPTIONS = Object.freeze([
  { value: 'auto', label: 'Auto' },
  { value: 'PAL', label: 'PAL 50Hz' },
  { value: 'NTSC', label: 'NTSC 60Hz' }
]);

const AMIGA_MODEL_PRESET_VALUES = new Set(AMIGA_MODEL_PRESET_OPTIONS.map(option => option.value));
const AMIGA_VIDEO_STANDARD_VALUES = new Set(AMIGA_VIDEO_STANDARD_OPTIONS.map(option => option.value));
const AMIGA_NO_MEDIA_CONFIG_FILE = 'no-media.uae';
const AMIGA_NO_MEDIA_MODEL_VALUES = new Set(['auto', 'A500', 'A1200']);
const AMIGA_SYSTEM_DIR = '/home/web_user/retroarch/userdata/system';
const AMIGA_NO_MEDIA_CONFIGS = Object.freeze({
  A500: Object.freeze({
    kickstart: 'kick34005.A500',
    cpu_model: '68000',
    fpu_model: '0',
    mmu_model: '0',
    chipmem_size: '1',
    bogomem_size: '2',
    fastmem_size: '0',
    z3mem_size: '0',
    cpu_24bit_addressing: 'true',
    chipset: 'ocs',
    chipset_compatible: 'A500'
  }),
  A1200: Object.freeze({
    kickstart: 'kick40068.A1200',
    cpu_model: '68020',
    fpu_model: '0',
    mmu_model: '0',
    chipmem_size: '4',
    bogomem_size: '0',
    fastmem_size: '0',
    z3mem_size: '0',
    cpu_24bit_addressing: 'true',
    chipset: 'aga',
    chipset_compatible: 'A1200'
  })
});

function isAmigaNoMediaConfig(fileName) {
  if (typeof fileName !== 'string') {
    return false;
  }
  return fileName.split(/[\\/]/).pop().toLowerCase() === AMIGA_NO_MEDIA_CONFIG_FILE;
}

function createAmigaNoMediaConfig(model) {
  const config = AMIGA_NO_MEDIA_CONFIGS[model] || AMIGA_NO_MEDIA_CONFIGS.A500;
  return [
    'config_description=VM/E No Media',
    `kickstart_rom_file=${AMIGA_SYSTEM_DIR}/${config.kickstart}`,
    `cpu_model=${config.cpu_model}`,
    `fpu_model=${config.fpu_model}`,
    `mmu_model=${config.mmu_model}`,
    `chipmem_size=${config.chipmem_size}`,
    `bogomem_size=${config.bogomem_size}`,
    `fastmem_size=${config.fastmem_size}`,
    `z3mem_size=${config.z3mem_size}`,
    `cpu_24bit_addressing=${config.cpu_24bit_addressing}`,
    `chipset=${config.chipset}`,
    `chipset_compatible=${config.chipset_compatible}`,
    'nr_floppies=0',
    'floppy0=',
    'floppy1=',
    'floppy2=',
    'floppy3=',
    'floppy0type=-1',
    'floppy1type=-1',
    'floppy2type=-1',
    'floppy3type=-1'
  ].join('\n');
}

function normalizeAmigaModelPreset(value, fallback = 'auto') {
  if (typeof value !== 'string') {
    return fallback;
  }
  const normalized = value.trim();
  return AMIGA_MODEL_PRESET_VALUES.has(normalized) ? normalized : fallback;
}

function normalizeAmigaVideoStandard(value, fallback = 'auto') {
  if (typeof value !== 'string') {
    return fallback;
  }
  const normalized = value.trim().toUpperCase();
  return AMIGA_VIDEO_STANDARD_VALUES.has(normalized) ? normalized : fallback;
}

function isAmigaModelPresetAvailable(option, availableBiosKeys) {
  if (!option || option.enabled === false || option.value === 'auto') {
    return option?.value === 'auto';
  }

  if (!(availableBiosKeys instanceof Set)) {
    return option.defaultAvailable === true;
  }

  if (Array.isArray(option.requiredBiosAny)) {
    return option.requiredBiosAny.some(group => group.every(key => availableBiosKeys.has(key)));
  }

  if (Array.isArray(option.requiredBios)) {
    return option.requiredBios.every(key => availableBiosKeys.has(key));
  }

  return true;
}

async function writeStoredSystemFile(storageManager, FS, storageKey, systemFileName = storageKey) {
  const data = await storageManager.getFile(`amiga.${storageKey}`);
  if (!data) {
    return false;
  }

  const bytes = (data && typeof data.arrayBuffer === 'function')
    ? new Uint8Array(await data.arrayBuffer())
    : new Uint8Array(data);
  FS.writeFile(`/home/web_user/retroarch/userdata/system/${systemFileName}`, bytes);
  return true;
}

function buildAmigaLaunchSettings(fileName, overrides = null, context = null) {
  const overrideInput = overrides && typeof overrides === 'object' ? overrides : {};
  const noMediaBoot = isAmigaNoMediaConfig(fileName);
  const requestedModel = normalizeAmigaModelPreset(overrideInput.model, 'auto');
  const model = noMediaBoot && !AMIGA_NO_MEDIA_MODEL_VALUES.has(requestedModel) ? 'auto' : requestedModel;
  const videoStandard = normalizeAmigaVideoStandard(overrideInput.video_standard, 'auto');
  const availableBiosKeys = context?.availableDependencyKeys;
  const selectedModelOption = AMIGA_MODEL_PRESET_OPTIONS.find(option => option.value === model);

  const coreConfig = {
    puae_video_vresolution: "single",
    puae_video_resolution: "hires",
    puae_crop_mode: "auto",
    puae_floppy_multidrive: "disabled"
  };

  if (!noMediaBoot) {
    if (selectedModelOption?.coreConfig) {
      Object.assign(coreConfig, selectedModelOption.coreConfig);
    } else if (model !== 'auto') {
      coreConfig.puae_model = model;
    }
  }

  if (videoStandard !== 'auto') {
    coreConfig.puae_video_standard = videoStandard;
  }

  return {
    bios: ['kick1x', 'kick2x', 'kick3x'],
    coreConfig,
    overrideValues: {
      model,
      video_standard: videoStandard
    },
    guessedOverrides: {
      model: 'auto',
      video_standard: 'auto'
    },
    overrideSchema: [
      {
        id: 'model',
        label: 'Model',
        options: AMIGA_MODEL_PRESET_OPTIONS.filter(option => {
          if (noMediaBoot && !AMIGA_NO_MEDIA_MODEL_VALUES.has(option.value)) {
            return false;
          }
          return isAmigaModelPresetAvailable(option, availableBiosKeys);
        })
      },
      {
        id: 'video_standard',
        label: 'Video',
        options: AMIGA_VIDEO_STANDARD_OPTIONS
      }
    ]
  };
}

const Amiga = {
  ...PlatformBase,
  platform_id: 'amiga',
  core: 'puae',
  multidisk: true,
  bios: ['kick1x', 'kick2x', 'kick3x'],
  platform_name: 'Commodore Amiga',
  short_name: 'Amiga',
  libretro_thumbnails_system: 'Commodore - Amiga',
  theme: {
    '--color0': '#A7A7A7',
    '--color1': '#000000',
    '--color2': '#666666',
    '--color3': '#ffffff',
    '--color4': '#6780ae',
    '--font': 'Topaz1200',
    '--cursorwidth': '0.5em',
    '--portrait-fontsize': '100%'
  },
  startup_beforelaunch: async function (nostalgist, storageManager) {
    const FS = nostalgist.getEmscriptenFS();

    await writeStoredSystemFile(storageManager, FS, 'kick33180.A500');
    await writeStoredSystemFile(storageManager, FS, 'kick34005.A500');
    await writeStoredSystemFile(storageManager, FS, 'kick37175.A500');
    await writeStoredSystemFile(storageManager, FS, 'kick37350.A600');
    await writeStoredSystemFile(storageManager, FS, 'kick40063.A600');
    await writeStoredSystemFile(storageManager, FS, 'kick39106.A1200');
    await writeStoredSystemFile(storageManager, FS, 'kick40068.A1200');
    await writeStoredSystemFile(storageManager, FS, 'kick39106.A4000');
    await writeStoredSystemFile(storageManager, FS, 'kick40068.A4000');
    await writeStoredSystemFile(storageManager, FS, 'kick34005.CDTV');
    await writeStoredSystemFile(storageManager, FS, 'kick40060.CD32');
    await writeStoredSystemFile(storageManager, FS, 'kick40060.CD32.ext');
    await writeStoredSystemFile(storageManager, FS, 'kick40060.CD32.combined', 'kick40060.CD32');
  },
  prepareLaunchRom: ({ launchRomInput, romName, launchSettings }) => {
    if (!isAmigaNoMediaConfig(romName)) {
      return launchRomInput;
    }
    const requestedModel = normalizeAmigaModelPreset(launchSettings?.overrideValues?.model, 'auto');
    const model = requestedModel === 'A1200' ? 'A1200' : 'A500';
    return new Blob([createAmigaNoMediaConfig(model)], { type: 'text/plain' });
  },
  resolveLaunchSettings: (fileName, overrides = null, context = null) => buildAmigaLaunchSettings(fileName, overrides, context),
  guessConfig: (fileName) => buildAmigaLaunchSettings(fileName).coreConfig,
  shader: ['assets/shaders/crt/crt-geom.glslp', 'assets/shaders/crt/shaders/crt-geom.glsl'],
  // force_scale: true,
  video_smooth: false,
  dependencies: [
    {
      key: "kick34005.A500",
      type: "A500 Kickstart v1.3 rev 34.005",
      required: true,
      accepted: ["82a21c1890cae844b3df741f2762d48d"]
    },
    {
      key: "kick33180.A500",
      type: "A500/A2000 Kickstart v1.2 rev 33.180",
      required: false,
      accepted: ["85ad74194e87c08904327de1a9443b7a"]
    },
    {
      key: "kick37175.A500",
      type: "A500+ Kickstart v2.04 rev 37.175",
      required: false,
      accepted: ["dc10d7bdd1b6f450773dfb558477c230"]
    },
    {
      key: "kick37350.A600",
      type: "A600 Kickstart v2.05 rev 37.350",
      required: false,
      accepted: ["465646c9b6729f77eea5314d1f057951"]
    },
    {
      key: "kick40063.A600",
      type: "A600 Kickstart v3.1 rev 40.063",
      required: true,
      accepted: ["e40a5dfb3d017ba8779faba30cbd1c8e"]
    },
    {
      key: "kick39106.A1200",
      type: "A1200 Kickstart v3.0 rev 39.106",
      required: false,
      accepted: ["b7cc148386aa631136f510cd29e42fc3"]
    },
    {
      key: "kick40068.A1200",
      type: "A1200 Kickstart v3.1 rev 40.068",
      required: true,
      accepted: ["646773759326fbac3b2311fd8c8793ee"]
    },
    {
      key: "kick39106.A4000",
      type: "A4000 Kickstart v3.0 rev 39.106",
      required: false,
      accepted: ["9b8bdd5a3fd32c2a5a6f5b1aefc799a5"]
    },
    {
      key: "kick40068.A4000",
      type: "A4000 Kickstart v3.1 rev 40.068",
      required: false,
      accepted: ["9bdedde6a4f33555b4a270c8ca53297d"]
    },
    {
      key: "kick34005.CDTV",
      type: "CDTV extended ROM v1.00",
      required: false,
      accepted: ["89da1838a24460e4b93f4f0c5d92d48d"]
    },
    {
      key: "kick40060.CD32",
      type: "CD32 Kickstart v3.1 rev 40.060",
      required: false,
      accepted: ["5f8924d013dd57a89cf349f4cdedc6b1"]
    },
    {
      key: "kick40060.CD32.ext",
      type: "CD32 extended ROM rev 40.060",
      required: false,
      accepted: ["bb72565701b1b6faece07d68ea5da639"]
    },
    {
      key: "kick40060.CD32.combined",
      type: "CD32 Kickstart + extended ROM v3.1 rev 40.060",
      required: false,
      accepted: ["f2f241bf094168cfb9e7805dc2856433"]
    },
  ],
  keyboard_controller_info: {
    "Arrow Keys": "Joystick Directions",
    "Z": "Joystick Fire",
    "Mouse": "Mouse"
  },
  arrow_keys: {
    up: { key: 'ArrowUp', code: 'ArrowUp', keyCode: 38 },
    down: { key: 'ArrowDown', code: 'ArrowDown', keyCode: 40 },
    left: { key: 'ArrowLeft', code: 'ArrowLeft', keyCode: 37 },
    right: { key: 'ArrowRight', code: 'ArrowRight', keyCode: 39 }
  },
  touch_controllers: [
    JOYSTICK_TOUCH_MODE.QUICKJOY_PRIMARY,
    JOYSTICK_TOUCH_MODE.QUICKSHOT_DYNAMIC,
    JOYSTICK_TOUCH_MODE.HIDEAWAY,
  ],
  mouse_controllers: [
    MOUSE_TOUCH_MODE.TRACKPAD_BUTTONS
  ],
  keyboard_controller_mapping: {
    input_player1_x: 'nul',
    input_player1_y: 'nul',
    input_player1_c: 'nul',
    input_player1_b: 'z', //fire
    input_player1_a: 'nul',
    input_player1_l: 'nul',
    input_player1_r: 'nul',
    input_player1_select: 'nul',
    input_player1_start: 'nul',
    input_player1_l2: 'nul',
    input_player1_r2: 'nul',
    input_player1_gun_start: 'nul',
    input_player1_gun_start_btn: 'nul',
    input_player1_gun_start_axis: 'nul',
    input_player1_gun_start_mbtn: 'nul',
    input_player1_gun_select: 'nul',
    input_player1_gun_select_btn: 'nul',
    input_player1_gun_select_axis: 'nul',
    input_player1_gun_select_mbtn: 'nul'
  },
  touch_controller_mapping: {
    input_player1_x: 'nul',
    input_player1_y: 'nul',
    input_player1_c: 'nul',
    input_player1_a: 'nul',
    input_player1_l: 'nul',
    input_player1_r: 'nul',
    input_player1_select: 'nul',
    input_player1_start: 'nul',
    input_player1_gun_start: 'nul',
    input_player1_gun_start_btn: 'nul',
    input_player1_gun_start_axis: 'nul',
    input_player1_gun_start_mbtn: 'nul',
    input_player1_gun_select: 'nul',
    input_player1_gun_select_btn: 'nul',
    input_player1_gun_select_axis: 'nul',
    input_player1_gun_select_mbtn: 'nul',
    input_player1_l2: 'F13', //lmb
    input_player1_r2: 'F14', //rmb
    input_player1_b: 'F15' //fire
  },
  custom_controllers: {
    special_button: {
      label: 'CUSTOM'
    },
    fastui_area: {
      landscape: '1 / 1 / span 50 / span 50',
      portrait: '1 / 1 / span 50 / span 50'
    },
    focus_defaults: {
      'amiga-pinball-1': true,
      'amiga-pinball-2': true,
      'amiga-worms': false
    },
    presets: [
     {
        "id": "amiga-pinball-1",
        "name": "Pinball 1",
        "description": "Pinball Dreams, Pinball Fantasies",
        "gameFocus": true,
        "layout": {
          "landscape": {
            "columns": 50,
            "rows": 50
          },
          "portrait": {
            "columns": 50,
            "rows": 50
          }
        },
        "elements": [
          {
            "id": "amiga-pinball-left-shift",
            "component": "SingleTouchButton",
            "binding": {
              "type": "keyboard",
              "key": {
                "key": "Shift",
                "code": "ShiftLeft",
                "keyCode": 16
              }
            },
            "gridArea": {
              "landscape": "37 / 1 / span 14 / span 10",
              "portrait": "44 / 1 / span 7 / span 23"
            },
            "label": "LEFT"
          },
          {
            "id": "amiga-pinball-right-shift",
            "component": "SingleTouchButton",
            "binding": {
              "type": "keyboard",
              "key": {
                "key": "Shift",
                "code": "ShiftRight",
                "keyCode": 16
              }
            },
            "gridArea": {
              "landscape": "37 / 41 / span 14 / span 10",
              "portrait": "44 / 28 / span 7 / span 23"
            },
            "label": "RIGHT"
          },
          {
            "id": "amiga-pinball-plunger",
            "component": "SingleTouchButton",
            "binding": {
              "type": "keyboard",
              "key": {
                "key": "ArrowDown",
                "code": "ArrowDown",
                "keyCode": 40
              }
            },
            "gridArea": {
              "landscape": "28 / 43 / span 8 / span 8",
              "portrait": "38 / 32 / span 5 / span 19"
            },
            "label": "PLUNGER"
          },
          {
            "id": "amiga-pinball-tilt",
            "component": "SingleTouchButton",
            "binding": {
              "type": "keyboard",
              "key": {
                "key": "X",
                "code": "Space",
                "keyCode": 32
              }
            },
            "gridArea": {
              "landscape": "28 / 1 / span 8 / span 8",
              "portrait": "38 / 1 / span 5 / span 19"
            },
            "label": "TILT"
          },
          {
            "id": "amiga-pinball-f1",
            "component": "SingleTouchButton",
            "binding": {
              "type": "keyboard",
              "key": {
                "key": "F1",
                "code": "F1",
                "keyCode": 112
              }
            },
            "gridArea": {
              "landscape": "3 / 5 / span 4 / span 4",
              "portrait": "26 / 11 / span 2 / span 9"
            },
            "label": "F1"
          },
          {
            "id": "amiga-pinball-f2",
            "component": "SingleTouchButton",
            "binding": {
              "type": "keyboard",
              "key": {
                "key": "F2",
                "code": "F2",
                "keyCode": 113
              }
            },
            "gridArea": {
              "landscape": "8 / 5 / span 4 / span 4",
              "portrait": "29 / 11 / span 2 / span 9"
            },
            "label": "F2"
          },
          {
            "id": "amiga-pinball-f3",
            "component": "SingleTouchButton",
            "binding": {
              "type": "keyboard",
              "key": {
                "key": "F3",
                "code": "F3",
                "keyCode": 114
              }
            },
            "gridArea": {
              "landscape": "13 / 5 / span 4 / span 4",
              "portrait": "32 / 11 / span 2 / span 9"
            },
            "label": "F3"
          },
          {
            "id": "amiga-pinball-f4",
            "component": "SingleTouchButton",
            "binding": {
              "type": "keyboard",
              "key": {
                "key": "F4",
                "code": "F4",
                "keyCode": 115
              }
            },
            "gridArea": {
              "landscape": "18 / 5 / span 4 / span 4",
              "portrait": "35 / 11 / span 2 / span 9"
            },
            "label": "F4"
          },
          {
            "id": "amiga-pinball-esc",
            "component": "SingleTouchButton",
            "binding": {
              "type": "keyboard",
              "key": {
                "key": "Escape",
                "code": "Escape",
                "keyCode": 27
              }
            },
            "gridArea": {
              "landscape": "3 / 47 / span 4 / span 4",
              "portrait": "26 / 42 / span 2 / span 9"
            },
            "label": "ESC"
          },
          {
            "id": "amiga-pinball-y",
            "component": "SingleTouchButton",
            "binding": {
              "type": "keyboard",
              "key": {
                "key": "y",
                "code": "KeyY",
                "keyCode": 89
              }
            },
            "gridArea": {
              "landscape": "8 / 47 / span 4 / span 4",
              "portrait": "29 / 42 / span 2 / span 9"
            },
            "label": "Y"
          }
        ]
      },
      {
        "id": "amiga-pinball-2",
        "name": "Pinball 2",
        "description": "Pinball Illusions",
        "gameFocus": true,
        "layout": {
          "landscape": {
            "columns": 50,
            "rows": 50
          },
          "portrait": {
            "columns": 50,
            "rows": 50
          }
        },
        "elements": [
          {
            "id": "amiga-pinball-left-shift",
            "component": "SingleTouchButton",
            "binding": {
              "type": "keyboard",
              "key": {
                "key": "Shift",
                "code": "ShiftLeft",
                "keyCode": 16
              }
            },
            "gridArea": {
              "landscape": "37 / 1 / span 14 / span 10",
              "portrait": "44 / 1 / span 7 / span 23"
            },
            "label": "LEFT"
          },
          {
            "id": "amiga-pinball-right-shift",
            "component": "SingleTouchButton",
            "binding": {
              "type": "keyboard",
              "key": {
                "key": "Shift",
                "code": "ShiftRight",
                "keyCode": 16
              }
            },
            "gridArea": {
              "landscape": "37 / 41 / span 14 / span 10",
              "portrait": "44 / 28 / span 7 / span 23"
            },
            "label": "RIGHT"
          },
          {
            "id": "amiga-pinball-plunger",
            "component": "SingleTouchButton",
            "binding": {
              "type": "keyboard",
              "key": {
                "key": "Enter",
                "code": "Enter",
                "keyCode": "13"
              }
            },
            "gridArea": {
              "landscape": "28 / 43 / span 8 / span 8",
              "portrait": "38 / 32 / span 5 / span 19"
            },
            "label": "PLUNGER"
          },
          {
            "id": "amiga-pinball-tilt",
            "component": "SingleTouchButton",
            "binding": {
              "type": "keyboard",
              "key": {
                "key": "X",
                "code": "Space",
                "keyCode": 32
              }
            },
            "gridArea": {
              "landscape": "28 / 1 / span 8 / span 4",
              "portrait": "38 / 1 / span 5 / span 9"
            },
            "label": "TILT"
          },
          {
            "id": "amiga-pinball-f1",
            "component": "SingleTouchButton",
            "binding": {
              "type": "keyboard",
              "key": {
                "key": "F1",
                "code": "F1",
                "keyCode": "112"
              }
            },
            "gridArea": {
              "landscape": "3 / 5 / span 4 / span 4",
              "portrait": "26 / 11 / span 2 / span 9"
            },
            "label": "F1"
          },
          {
            "id": "amiga-pinball-f2",
            "component": "SingleTouchButton",
            "binding": {
              "type": "keyboard",
              "key": {
                "key": "ArrowUp",
                "code": "ArrowUp",
                "keyCode": "38"
              }
            },
            "gridArea": {
              "landscape": "8 / 5 / span 4 / span 4",
              "portrait": "29 / 11 / span 2 / span 9"
            },
            "label": "▲"
          },
          {
            "id": "amiga-pinball-f3",
            "component": "SingleTouchButton",
            "binding": {
              "type": "keyboard",
              "key": {
                "key": "ArrowDown",
                "code": "ArrowDown",
                "keyCode": "40"
              }
            },
            "gridArea": {
              "landscape": "13 / 5 / span 4 / span 4",
              "portrait": "32 / 11 / span 2 / span 9"
            },
            "label": "▼"
          },
          {
            "id": "amiga-pinball-f4",
            "component": "SingleTouchButton",
            "binding": {
              "type": "keyboard",
              "key": {
                "key": "X",
                "code": "Space",
                "keyCode": "32"
              }
            },
            "gridArea": {
              "landscape": "18 / 5 / span 4 / span 4",
              "portrait": "35 / 11 / span 2 / span 9"
            },
            "label": "OK"
          },
          {
            "id": "amiga-pinball-esc",
            "component": "SingleTouchButton",
            "binding": {
              "type": "keyboard",
              "key": {
                "key": "Escape",
                "code": "Escape",
                "keyCode": 27
              }
            },
            "gridArea": {
              "landscape": "3 / 47 / span 4 / span 4",
              "portrait": "26 / 42 / span 2 / span 9"
            },
            "label": "ESC"
          },
          {
            "id": "amiga-pinball-y",
            "component": "SingleTouchButton",
            "binding": {
              "type": "keyboard",
              "key": {
                "key": "y",
                "code": "KeyY",
                "keyCode": 89
              }
            },
            "gridArea": {
              "landscape": "8 / 47 / span 4 / span 4",
              "portrait": "29 / 42 / span 2 / span 9"
            },
            "label": "Y"
          },
          {
            "id": "tilt-2",
            "component": "SingleTouchButton",
            "binding": {
              "type": "keyboard",
              "key": {
                "key": "Meta",
                "code": "MetaLeft",
                "keyCode": "91"
              }
            },
            "gridArea": {
              "landscape": "28 / 5 / span 8 / span 4",
              "portrait": "38 / 11 / span 5 / span 9"
            },
            "label": "TILT"
          }
        ]
      },
      {
        "id": "amiga-pinball-3",
        "name": "Pinball 3",
        "description": "Slam Tilt",
        "gameFocus": true,
        "layout": {
          "landscape": {
            "columns": 50,
            "rows": 50
          },
          "portrait": {
            "columns": 50,
            "rows": 50
          }
        },
        "elements": [
          {
            "id": "amiga-pinball-left-shift",
            "component": "SingleTouchButton",
            "binding": {
              "type": "keyboard",
              "key": {
                "key": "Alt",
                "code": "AltLeft",
                "keyCode": 18
              }
            },
            "gridArea": {
              "landscape": "37 / 1 / span 14 / span 10",
              "portrait": "44 / 1 / span 7 / span 23"
            },
            "label": "LEFT"
          },
          {
            "id": "amiga-pinball-right-shift",
            "component": "SingleTouchButton",
            "binding": {
              "type": "keyboard",
              "key": {
                "key": "Alt",
                "code": "AltRight",
                "keyCode": 18
              }
            },
            "gridArea": {
              "landscape": "37 / 41 / span 14 / span 10",
              "portrait": "44 / 28 / span 7 / span 23"
            },
            "label": "RIGHT"
          },
          {
            "id": "amiga-pinball-plunger",
            "component": "SingleTouchButton",
            "binding": {
              "type": "keyboard",
              "key": {
                "key": "Enter",
                "code": "Enter",
                "keyCode": "13"
              }
            },
            "gridArea": {
              "landscape": "27 / 43 / span 9 / span 8",
              "portrait": "38 / 32 / span 5 / span 19"
            },
            "label": "PLUNGER"
          },
          {
            "id": "amiga-pinball-tilt",
            "component": "SingleTouchButton",
            "binding": {
              "type": "keyboard",
              "key": {
                "key": "Meta",
                "code": "MetaLeft",
                "keyCode": 19
              }
            },
            "gridArea": {
              "landscape": "28 / 1 / span 8 / span 4",
              "portrait": "38 / 1 / span 5 / span 9"
            },
            "label": "TILT"
          },
          {
            "id": "amiga-pinball-f1",
            "component": "SingleTouchButton",
            "binding": {
              "type": "keyboard",
              "key": {
                "key": "F1",
                "code": "F1",
                "keyCode": "112"
              }
            },
            "gridArea": {
              "landscape": "3 / 5 / span 4 / span 4",
              "portrait": "26 / 11 / span 2 / span 9"
            },
            "label": "F1"
          },
          {
            "id": "amiga-pinball-f2",
            "component": "SingleTouchButton",
            "binding": {
              "type": "keyboard",
              "key": {
                "key": "ArrowUp",
                "code": "ArrowUp",
                "keyCode": "38"
              }
            },
            "gridArea": {
              "landscape": "8 / 5 / span 4 / span 4",
              "portrait": "29 / 11 / span 2 / span 9"
            },
            "label": "▲"
          },
          {
            "id": "amiga-pinball-f3",
            "component": "SingleTouchButton",
            "binding": {
              "type": "keyboard",
              "key": {
                "key": "ArrowDown",
                "code": "ArrowDown",
                "keyCode": "40"
              }
            },
            "gridArea": {
              "landscape": "13 / 5 / span 4 / span 4",
              "portrait": "32 / 11 / span 2 / span 9"
            },
            "label": "▼"
          },
          {
            "id": "amiga-pinball-f4",
            "component": "SingleTouchButton",
            "binding": {
              "type": "keyboard",
              "key": {
                "key": "X",
                "code": "Space",
                "keyCode": "32"
              }
            },
            "gridArea": {
              "landscape": "18 / 5 / span 4 / span 4",
              "portrait": "35 / 11 / span 2 / span 9"
            },
            "label": "OK"
          },
          {
            "id": "amiga-pinball-esc",
            "component": "SingleTouchButton",
            "binding": {
              "type": "keyboard",
              "key": {
                "key": "Escape",
                "code": "Escape",
                "keyCode": 27
              }
            },
            "gridArea": {
              "landscape": "3 / 47 / span 4 / span 4",
              "portrait": "26 / 42 / span 2 / span 9"
            },
            "label": "ESC"
          },
          {
            "id": "amiga-pinball-y",
            "component": "SingleTouchButton",
            "binding": {
              "type": "keyboard",
              "key": {
                "key": "y",
                "code": "KeyY",
                "keyCode": 89
              }
            },
            "gridArea": {
              "landscape": "8 / 47 / span 4 / span 4",
              "portrait": "29 / 42 / span 2 / span 9"
            },
            "label": "Y"
          },
          {
            "id": "tilt-2",
            "component": "SingleTouchButton",
            "binding": {
              "type": "keyboard",
              "key": {
                "key": "Meta",
                "code": "MetaRight",
                "keyCode": "93"
              }
            },
            "gridArea": {
              "landscape": "28 / 5 / span 8 / span 4",
              "portrait": "38 / 11 / span 5 / span 9"
            },
            "label": "TILT"
          }
        ]
      },
      {
        "id": "amiga-worms",
        "name": "Worms (1995)",
        "description": "incl. Touchpad (tap to click)",
        "gameFocus": false,
        "layout": {
          "landscape": {
            "columns": 50,
            "rows": 50
          },
          "portrait": {
            "columns": 50,
            "rows": 50
          }
        },
        "elements": [
          {
            "id": "worms-pad",
            "component": "TouchpadComponent",
            "binding": {
              "type": "joy"
            },
            "gridArea": {
              "landscape": "27 / 16 / span 24 / span 21",
              "portrait": "38 / 16 / span 13 / span 19"
            },
            "label": "worms-pad",
            "options": {
              "style": "tab",
              "tapToClick": true,
              "anywhere": true,
              "label": ""
            }
          },
          {
            "id": "worms-mv",
            "component": "QuickshotComponent",
            "binding": {
              "type": "joy"
            },
            "gridArea": {
              "landscape": "32 / 1 / span 19 / span 11",
              "portrait": "38 / 1 / span 13 / span 14"
            },
            "label": "worms-mv",
            "options": {
              "label": "MOVE/AIM",
              "style": "outline",
              "mode": "keyboard",
              "keys": {
                "up": {
                  "key": "d",
                  "code": "KeyD",
                  "keyCode": "68"
                },
                "down": {
                  "key": "x",
                  "code": "KeyX",
                  "keyCode": "88"

                },
                "left": {
                  "key": "z",
                  "code": "KeyZ",
                  "keyCode": "90"
                },
                "right": {
                  "key": "c",
                  "code": "KeyC",
                  "keyCode": "67"
                }
              }
            }
          },
          {
            "id": "worms-jump",
            "component": "SingleTouchButton",
            "binding": {
              "type": "keyboard",
              "key": {
                "key": "Enter",
                "code": "Enter",
                "keyCode": "13"
              }
            },
            "gridArea": {
              "landscape": "41 / 40 / span 10 / span 11",
              "portrait": "43 / 36 / span 8 / span 15"
            },
            "label": "JUMP"
          },
          {
            "id": "worms-p",
            "component": "SingleTouchButton",
            "binding": {
              "type": "keyboard",
              "key": {
                "key": "p",
                "code": "KeyP",
                "keyCode": "80"
              }
            },
            "gridArea": {
              "landscape": "3 / 47 / span 4 / span 4",
              "portrait": "26 / 42 / span 2 / span 9"
            },
            "label": "PAUSE"
          },
          {
            "id": "worms-tab",
            "component": "SingleTouchButton",
            "binding": {
              "type": "keyboard",
              "key": {
                "key": "Tab",
                "code": "Tab",
                "keyCode": "9"
              }
            },
            "gridArea": {
              "landscape": "8 / 47 / span 4 / span 4",
              "portrait": "29 / 42 / span 2 / span 9"
            },
            "label": "CENTER"
          },
          {
            "id": "worms-tilde",
            "component": "SingleTouchButton",
            "binding": {
              "type": "keyboard",
              "key": {
                "key": "`",
                "code": "Backquote",
                "keyCode": "192"
              }
            },
            "gridArea": {
              "landscape": "13 / 47 / span 4 / span 4",
              "portrait": "32 / 42 / span 2 / span 9"
            },
            "label": "NAMES"
          },
          {
            "id": "worms-fire",
            "component": "SingleTouchButton",
            "binding": {
              "type": "keyboard",
              "key": {
                "key": "x",
                "code": "Space",
                "keyCode": "32"
              }
            },
            "gridArea": {
              "landscape": "32 / 40 / span 8 / span 11",
              "portrait": "38 / 36 / span 4 / span 15"
            },
            "label": "FIRE"
          },
          {
            "id": "worms-f1",
            "component": "SingleTouchButton",
            "binding": {
              "type": "keyboard",
              "key": {
                "key": "F2",
                "code": "F2",
                "keyCode": "113"
              }
            },
            "gridArea": {
              "landscape": "28 / 3 / span 3 / span 2",
              "portrait": "26 / 18 / span 2 / span 6"
            },
            "label": "F2"
          },
          {
            "id": "worms-f2",
            "component": "SingleTouchButton",
            "binding": {
              "type": "keyboard",
              "key": {
                "key": "F1",
                "code": "F1",
                "keyCode": "112"
              }
            },
            "gridArea": {
              "landscape": "28 / 1 / span 3 / span 2",
              "portrait": "26 / 11 / span 2 / span 6"
            },
            "label": "F1"
          },
          {
            "id": "worms-f3",
            "component": "SingleTouchButton",
            "binding": {
              "type": "keyboard",
              "key": {
                "key": "F3",
                "code": "F3",
                "keyCode": "114"
              }
            },
            "gridArea": {
              "landscape": "28 / 5 / span 3 / span 2",
              "portrait": "26 / 25 / span 2 / span 6"
            },
            "label": "F3"
          },
          {
            "id": "worms-f4",
            "component": "SingleTouchButton",
            "binding": {
              "type": "keyboard",
              "key": {
                "key": "F4",
                "code": "F4",
                "keyCode": "115"
              }
            },
            "gridArea": {
              "landscape": "28 / 7 / span 3 / span 2",
              "portrait": "29 / 11 / span 2 / span 6"
            },
            "label": "F4"
          },
          {
            "id": "worms-f5",
            "component": "SingleTouchButton",
            "binding": {
              "type": "keyboard",
              "key": {
                "key": "F5",
                "code": "F5",
                "keyCode": "116"
              }
            },
            "gridArea": {
              "landscape": "28 / 9 / span 3 / span 2",
              "portrait": "29 / 18 / span 2 / span 6"
            },
            "label": "F5"
          },
          {
            "id": "worms-f6",
            "component": "SingleTouchButton",
            "binding": {
              "type": "keyboard",
              "key": {
                "key": "F6",
                "code": "F6",
                "keyCode": "117"
              }
            },
            "gridArea": {
              "landscape": "28 / 41 / span 3 / span 2",
              "portrait": "29 / 25 / span 2 / span 6"
            },
            "label": "F6"
          },
          {
            "id": "worms-f7",
            "component": "SingleTouchButton",
            "binding": {
              "type": "keyboard",
              "key": {
                "key": "F7",
                "code": "F7",
                "keyCode": "118"
              }
            },
            "gridArea": {
              "landscape": "28 / 43 / span 3 / span 2",
              "portrait": "32 / 11 / span 2 / span 6"
            },
            "label": "F7"
          },
          {
            "id": "worms-f8",
            "component": "SingleTouchButton",
            "binding": {
              "type": "keyboard",
              "key": {
                "key": "F8",
                "code": "F8",
                "keyCode": "119"
              }
            },
            "gridArea": {
              "landscape": "28 / 45 / span 3 / span 2",
              "portrait": "32 / 18 / span 2 / span 6"
            },
            "label": "F8"
          },
          {
            "id": "worms-f9",
            "component": "SingleTouchButton",
            "binding": {
              "type": "keyboard",
              "key": {
                "key": "F9",
                "code": "F9",
                "keyCode": "120"
              }
            },
            "gridArea": {
              "landscape": "28 / 47 / span 3 / span 2",
              "portrait": "32 / 25 / span 2 / span 6"
            },
            "label": "F9"
          },
          {
            "id": "worms-f10",
            "component": "SingleTouchButton",
            "binding": {
              "type": "keyboard",
              "key": {
                "key": "F10",
                "code": "F10",
                "keyCode": "121"
              }
            },
            "gridArea": {
              "landscape": "28 / 49 / span 3 / span 2",
              "portrait": "35 / 11 / span 2 / span 6"
            },
            "label": "F10"
          },
          {
            "id": "worms-right",
            "component": "SingleTouchButton",
            "binding": {
              "type": "keyboard",
              "key": {
                "key": "F14",
                "code": "F14",
                "keyCode": "125"
              }
            },
            "gridArea": {
              "landscape": "18 / 5 / span 4 / span 4",
              "portrait": "35 / 18 / span 2 / span 13"
            },
            "label": "ARMS"
          },
          {
            "id": "worms-1",
            "component": "SingleTouchButton",
            "binding": {
              "type": "keyboard",
              "key": {
                "key": "1",
                "code": "Digit1",
                "keyCode": "49"
              }
            },
            "gridArea": {
              "landscape": "5 / 7 / span 3 / span 2",
              "portrait": "24 / 15 / span 1 / span 3"
            },
            "label": "1"
          },
          {
            "id": "worms-2",
            "component": "SingleTouchButton",
            "binding": {
              "type": "keyboard",
              "key": {
                "key": "2",
                "code": "Digit2",
                "keyCode": "50"
              }
            },
            "gridArea": {
              "landscape": "8 / 5 / span 3 / span 2",
              "portrait": "24 / 18 / span 1 / span 3"
            },
            "label": "2"
          },
          {
            "id": "worms-3",
            "component": "SingleTouchButton",
            "binding": {
              "type": "keyboard",
              "key": {
                "key": "3",
                "code": "Digit3",
                "keyCode": "51"
              }
            },
            "gridArea": {
              "landscape": "8 / 7 / span 3 / span 2",
              "portrait": "24 / 21 / span 1 / span 3"
            },
            "label": "3"
          },
          {
            "id": "worms-4",
            "component": "SingleTouchButton",
            "binding": {
              "type": "keyboard",
              "key": {
                "key": "4",
                "code": "Digit4",
                "keyCode": "52"
              }
            },
            "gridArea": {
              "landscape": "11 / 5 / span 3 / span 2",
              "portrait": "24 / 24 / span 1 / span 3"
            },
            "label": "4"
          },
          {
            "id": "worms-5",
            "component": "SingleTouchButton",
            "binding": {
              "type": "keyboard",
              "key": {
                "key": "5",
                "code": "Digit5",
                "keyCode": "53"
              }
            },
            "gridArea": {
              "landscape": "11 / 7 / span 3 / span 2",
              "portrait": "24 / 27 / span 1 / span 3"
            },
            "label": "5"
          },
          {
            "id": "worms-minus",
            "component": "SingleTouchButton",
            "binding": {
              "type": "keyboard",
              "key": {
                "key": "-",
                "code": "Minus",
                "keyCode": "189"
              }
            },
            "gridArea": {
              "landscape": "14 / 5 / span 3 / span 2",
              "portrait": "24 / 30 / span 1 / span 3"
            },
            "label": "LO"
          },
          {
            "id": "worms-plus",
            "component": "SingleTouchButton",
            "binding": {
              "type": "keyboard",
              "key": {
                "key": "=",
                "code": "Equal",
                "keyCode": "187",
                "shiftKey": true
              }
            },
            "gridArea": {
              "landscape": "14 / 7 / span 3 / span 2",
              "portrait": "24 / 33 / span 1 / span 3"
            },
            "label": "HI"
          }
        ]
      }

    ]
  },
  game_profiles: [
    {
      id: 'amiga-pinball-1-profile',
      match: {
        romHash: AMIGA_PINBALL_1_HASHES
      },
      touch: {
        customPresetId: 'amiga-pinball-1'
      }
    },
    {
      id: 'amiga-pinball-2-profile',
      match: {
        romHash: AMIGA_PINBALL_2_HASHES
      },
      touch: {
        customPresetId: 'amiga-pinball-2'
      }
    },
    {
      id: 'amiga-pinball-3-profile',
      match: {
        romHash: AMIGA_PINBALL_3_HASHES
      },
      touch: {
        customPresetId: 'amiga-pinball-3'
      }
    },
    {
      id: 'amiga-worms',
      match: {
        romHash: AMIGA_WORMS
      },
      touch: {
        customPresetId: 'amiga-worms'
      }
    }
  ],
  fire_buttons: 1,
  keyboard: {
    shiftKey: 2,
    overrides: {
    }
  },
  additional_keyboard: {
    "layerF": [
      { "id": "keyFA29", "value": "ArrowUp", "code": "ArrowUp", "label": "↑" },
      { "id": "keyFA39", "value": "ArrowDown", "code": "ArrowDown", "label": "↓" },
      { "id": "keyF21", "value": "ArrowLeft", "code": "ArrowLeft", "label": "←" },
      { "id": "keyF22", "value": "ArrowRight", "code": "ArrowRight", "label": "→" },
      { "id": "keyF14", "value": "F1", "code": "F1", "label": "F1" },
      { "id": "keyF15", "value": "F2", "code": "F2", "label": "F2" },
      { "id": "keyF16", "value": "F3", "code": "F3", "label": "F3" },
      { "id": "keyF24", "value": "F4", "code": "F4", "label": "F4" },
      { "id": "keyF25", "value": "F5", "code": "F5", "label": "F5" },
      { "id": "keyF26", "value": "F6", "code": "F6", "label": "F6" },
      { "id": "keyF34", "value": "F7", "code": "F7", "label": "F7" },
      { "id": "keyF35", "value": "F8", "code": "F8", "label": "F8" },
      { "id": "keyF36", "value": "F9", "code": "F9", "label": "F9" },
      { "id": "keyF45", "value": "F10", "code": "F10", "label": "F10" },
      { "id": "keyFL11", "value": "shift", "code": "ShiftLeft", "label": "LShift" },
      { "id": "keyFR11", "value": "shift", "code": "ShiftRight", "label": "RShift" }
    ]
  },
  additional_buttons: {
  },
  rewind_granularity: 25,
  fastforward_ratio: 10,
};

export default Amiga;
