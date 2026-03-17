package indexer

import (
	"math/big"
	"testing"

	"github.com/ethereum/go-ethereum/common"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestDecodeUint256_Basic(t *testing.T) {
	data := common.LeftPadBytes(big.NewInt(42).Bytes(), 32)
	v, err := DecodeUint256(data, 0)
	require.NoError(t, err)
	assert.Equal(t, big.NewInt(42), v)
}

func TestDecodeUint256_LargeValue(t *testing.T) {
	large := new(big.Int)
	large.SetString("115792089237316195423570985008687907853269984665640564039457584007913129639935", 10) // 2^256 - 1
	data := common.LeftPadBytes(large.Bytes(), 32)
	v, err := DecodeUint256(data, 0)
	require.NoError(t, err)
	assert.Equal(t, large, v)
}

func TestDecodeUint256_Zero(t *testing.T) {
	data := make([]byte, 32)
	v, err := DecodeUint256(data, 0)
	require.NoError(t, err)
	assert.Equal(t, 0, v.Sign())
}

func TestDecodeUint256_SecondWord(t *testing.T) {
	word0 := common.LeftPadBytes(big.NewInt(100).Bytes(), 32)
	word1 := common.LeftPadBytes(big.NewInt(200).Bytes(), 32)
	data := append(word0, word1...)
	v, err := DecodeUint256(data, 1)
	require.NoError(t, err)
	assert.Equal(t, big.NewInt(200), v)
}

func TestDecodeUint256_DataTooShort(t *testing.T) {
	data := make([]byte, 16)
	_, err := DecodeUint256(data, 0)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "data too short")
}

func TestDecodeUint8_Valid(t *testing.T) {
	data := common.LeftPadBytes([]byte{5}, 32)
	v, err := DecodeUint8(data, 0)
	require.NoError(t, err)
	assert.Equal(t, uint8(5), v)
}

func TestDecodeUint8_Overflow(t *testing.T) {
	data := common.LeftPadBytes(big.NewInt(256).Bytes(), 32)
	_, err := DecodeUint8(data, 0)
	assert.Error(t, err)
	assert.Contains(t, err.Error(), "does not fit in uint8")
}

func TestDecodeAddress_FromTopic(t *testing.T) {
	addr := common.HexToAddress("0x1234567890abcdef1234567890abcdef12345678")
	topic := common.BytesToHash(common.LeftPadBytes(addr.Bytes(), 32))
	decoded := DecodeAddress(topic)
	assert.Equal(t, addr, decoded)
}

func TestDecodeBytes32(t *testing.T) {
	h := common.HexToHash("0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef")
	result := DecodeBytes32(h)
	assert.Equal(t, h.Hex(), result)
}

func TestDecodeAddressFromData(t *testing.T) {
	addr := common.HexToAddress("0xabcdef1234567890abcdef1234567890abcdef12")
	data := common.LeftPadBytes(addr.Bytes(), 32)
	decoded, err := DecodeAddressFromData(data, 0)
	require.NoError(t, err)
	assert.Equal(t, addr, decoded)
}

func TestDecodeAddressFromData_TooShort(t *testing.T) {
	_, err := DecodeAddressFromData([]byte{1, 2, 3}, 0)
	assert.Error(t, err)
}

func TestDecodeDynamicString(t *testing.T) {
	// Build: word0 = pointer (0x20 = 32), word1 = length (5), word2 = "hello" + padding
	pointer := common.LeftPadBytes(big.NewInt(32).Bytes(), 32)
	strLen := common.LeftPadBytes(big.NewInt(5).Bytes(), 32)
	strData := make([]byte, 32)
	copy(strData, []byte("hello"))

	data := append(pointer, strLen...)
	data = append(data, strData...)

	s, err := DecodeDynamicString(data, 0)
	require.NoError(t, err)
	assert.Equal(t, "hello", s)
}

func TestDecodeDynamicString_MalformedPointer(t *testing.T) {
	data := make([]byte, 10) // too short for pointer
	_, err := DecodeDynamicString(data, 0)
	assert.Error(t, err)
}

func TestEventSignatureHash_Matches(t *testing.T) {
	// Verify the hash function produces deterministic results.
	h1 := EventSignatureHash("Transfer(address,address,uint256)")
	h2 := EventSignatureHash("Transfer(address,address,uint256)")
	assert.Equal(t, h1, h2)

	// Different signatures should produce different hashes.
	h3 := EventSignatureHash("Approval(address,address,uint256)")
	assert.NotEqual(t, h1, h3)
}

func TestHexToBytes(t *testing.T) {
	tests := []struct {
		name  string
		input string
		want  []byte
	}{
		{"with prefix", "0xdeadbeef", []byte{0xde, 0xad, 0xbe, 0xef}},
		{"without prefix", "deadbeef", []byte{0xde, 0xad, 0xbe, 0xef}},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := HexToBytes(tt.input)
			require.NoError(t, err)
			assert.Equal(t, tt.want, got)
		})
	}
}

func TestHexToBytes_Invalid(t *testing.T) {
	_, err := HexToBytes("0xGGGG")
	assert.Error(t, err)
}

func TestUint256ToString(t *testing.T) {
	assert.Equal(t, "42", Uint256ToString(big.NewInt(42)))
	assert.Equal(t, "0", Uint256ToString(nil))
	assert.Equal(t, "0", Uint256ToString(big.NewInt(0)))
}
